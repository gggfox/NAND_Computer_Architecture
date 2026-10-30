import { endpointInfo, findChip, pinKeys } from "~/features/projects";
import type { ChipInstance, InstanceKind, PinKey, Project } from "~/features/projects";
import type { NetlistSource, SignalRef } from "~/features/simulation";
import { assertNever } from "~/shared/assert-never";
import type { ChipId, InstanceId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import { indexOf, sinkKey as pinKeyOf } from "./flatten-index";
import { enumerate, getIn, pieceOf, setIn, unconnected } from "./flatten-walk";
import type { Frame, NetlistSourceError, PerFrame, PinBit, Walk } from "./flatten-walk";
import { ioLayout } from "./io-layout";
import type { IoLayout } from "./io-layout";

export type { NetlistSourceError } from "./flatten-walk";

/** One pin of an instance on the open chip, and the signal behind each of its bits. */
interface Probe {
  readonly instanceId: InstanceId;
  readonly pin: PinKey;
  readonly bits: readonly SignalRef[];
}

/** The engine's netlist and where each of the open chip's pins sits in its inputs and outputs. */
export interface Flattened {
  readonly source: NetlistSource;
  readonly layout: IoLayout;
  /** Every pin on the open chip whose bits all resolve; unconnected pins are left out. */
  readonly probes: readonly Probe[];
}

type Outcome<T> = Result<T, NetlistSourceError>;

/** The walk plus the resolution memo and the sinks being resolved right now. */
interface Resolver {
  readonly walk: Walk;
  readonly layout: IoLayout;
  readonly memo: PerFrame<string, SignalRef>;
  /** Sink bits being resolved right now, per frame. */
  readonly active: PerFrame<string, true>;
}

const NAND_A = 0;
const NAND_B = 1;
const CLOCK: SignalRef = { kind: "clock" };

/** One sink bit within its frame. */
const bitKey = (at: PinBit): string => `${at.instanceId}:${String(at.pin)}:${String(at.bit)}`;

/** The signal driving one sink bit, memoised. */
const sink = (resolver: Resolver, frame: Frame, at: PinBit): Outcome<SignalRef> => {
  const key = bitKey(at);
  const known = getIn(resolver.memo, frame, key);
  return known === undefined ? resolveSink(resolver, frame, at, key) : ok(known);
};

/** Re-entering a sink bit that is still being resolved is a `WireLoop`. */
// oxlint-disable-next-line eslint/max-params -- the key is passed along so it is built once
const resolveSink = (
  resolver: Resolver,
  frame: Frame,
  at: PinBit,
  key: string,
): Outcome<SignalRef> => {
  if (getIn(resolver.active, frame, key) !== undefined) {
    return err({ type: "WireLoop", path: frame.path, instanceId: at.instanceId });
  }
  setIn(resolver.active, frame, key, true);
  const resolved = drive(resolver, frame, at);
  resolver.active.get(frame)?.delete(key);
  if (resolved.ok) {
    setIn(resolver.memo, frame, key, resolved.value);
  }
  return resolved;
};

/** Follows the one wire into the sink bit back to the bit of the source that drives it. */
const drive = (resolver: Resolver, frame: Frame, at: PinBit): Outcome<SignalRef> => {
  const wires = indexOf(frame.circuit).sinks.get(pinKeyOf(at.instanceId, at.pin));
  const driver = wires?.find((item) => item.to.bit === undefined || item.to.bit === at.bit);
  if (driver === undefined) {
    return err(unconnected(frame, at));
  }
  const bit = driver.from.bit ?? (driver.to.bit === undefined ? at.bit : 0);
  return source(resolver, frame, { instanceId: driver.from.instanceId, pin: driver.from.pin, bit });
};

const source = (resolver: Resolver, frame: Frame, at: PinBit): Outcome<SignalRef> => {
  // `findInvalidWire` already checked that every wire starts on a source pin of a real instance.
  const instance = indexOf(frame.circuit).instances.get(at.instanceId);
  return instance === undefined
    ? err(unconnected(frame, at))
    : sourceOfKind(resolver, { frame, kind: instance.kind, at });
};

interface SourcePin {
  readonly frame: Frame;
  readonly kind: InstanceKind;
  readonly at: PinBit;
}

const sourceOfKind = (resolver: Resolver, { frame, kind, at }: SourcePin): Outcome<SignalRef> => {
  const { instanceId, bit } = at;
  switch (kind.type) {
    case "nand": {
      const index = getIn(resolver.walk.nandIndex, frame, instanceId);
      return index === undefined ? err(unconnected(frame, at)) : ok({ kind: "nand", index });
    }
    case "clock": {
      return ok(CLOCK);
    }
    case "pin": {
      return inputSource(resolver, frame, { instanceId, pin: kind.pinId, bit });
    }
    case "split": {
      return sink(resolver, frame, { instanceId, pin: 0, bit: Number(at.pin) - 1 });
    }
    case "merge": {
      return sink(resolver, frame, { instanceId, pin: bit, bit: 0 });
    }
    case "custom": {
      return customSource(resolver, frame, at);
    }
    default: {
      return assertNever(kind);
    }
  }
};

/** An input pin piece carries whatever drives that pin outside its chip, or an engine input at the top. */
const inputSource = (
  resolver: Resolver,
  frame: Frame,
  { instanceId, pin, bit }: PinBit,
): Outcome<SignalRef> => {
  if (frame.host !== undefined) {
    return sink(resolver, frame.host.frame, { instanceId: frame.host.instanceId, pin, bit });
  }
  const slot = resolver.layout.inputs.find((item) => item.pinId === pin);
  return slot === undefined
    ? err(unconnected(frame, { instanceId, pin: 0, bit }))
    : ok({ kind: "input", index: slot.offset + bit });
};

/** A custom chip's output pin carries whatever drives that pin's piece inside its saved version. */
const customSource = (resolver: Resolver, frame: Frame, at: PinBit): Outcome<SignalRef> => {
  const child = getIn(resolver.walk.frames, frame, at.instanceId);
  const pieceId = child && pieceOf(child.circuit, at.pin);
  return child === undefined || pieceId === undefined
    ? err(unconnected(frame, at))
    : sink(resolver, child, { instanceId: pieceId, pin: 0, bit: at.bit });
};

/** Maps every item, stopping at the first failure. */
const mapAll = <T, U>(
  items: readonly T[],
  each: (item: T) => Outcome<U>,
): Outcome<readonly U[]> => {
  const values: U[] = [];
  for (const item of items) {
    const outcome = each(item);
    if (!outcome.ok) {
      return outcome;
    }
    values.push(outcome.value);
  }
  return ok(values);
};

const resolveNand = (
  resolver: Resolver,
  { frame, instanceId }: Walk["nands"][number],
): Outcome<NetlistSource["nands"][number]> => {
  const first = sink(resolver, frame, { instanceId, pin: NAND_A, bit: 0 });
  if (!first.ok) {
    return first;
  }
  const second = sink(resolver, frame, { instanceId, pin: NAND_B, bit: 0 });
  return second.ok ? ok({ a: first.value, b: second.value }) : second;
};

/** Every bit of every output pin's piece, in layout order. */
const outputBits = (top: Frame, layout: IoLayout): Outcome<readonly PinBit[]> => {
  const slots = mapAll(layout.outputs, (slot) => {
    const instanceId = pieceOf(top.circuit, slot.pinId);
    return instanceId === undefined
      ? err<NetlistSourceError>({ type: "UnconnectedPin", path: top.path, pin: slot.pinId, bit: 0 })
      : ok(Array.from({ length: slot.width }, (_unused, bit) => ({ instanceId, pin: 0, bit })));
  });
  return slots.ok ? ok(slots.value.flat()) : slots;
};

const inputCountOf = (layout: IoLayout): number => {
  const last = layout.inputs.at(-1);
  return last === undefined ? 0 : last.offset + last.width;
};

/** Every NAND's inputs, then every output bit, resolved to the engine's netlist. */
const resolveNetlist = (resolver: Resolver, top: Frame): Outcome<NetlistSource> => {
  const nands = mapAll(resolver.walk.nands, (nand) => resolveNand(resolver, nand));
  if (!nands.ok) {
    return nands;
  }
  const bits = outputBits(top, resolver.layout);
  if (!bits.ok) {
    return bits;
  }
  const outputs = mapAll(bits.value, (at) => sink(resolver, top, at));
  return outputs.ok
    ? ok({ inputCount: inputCountOf(resolver.layout), nands: nands.value, outputs: outputs.value })
    : outputs;
};

/** The signal behind each bit of one pin, or `undefined` when the pin or a bit does not resolve. */
// oxlint-disable-next-line eslint/max-params -- the resolver, the open chip's frame, the instance and its pin
const probePin = (
  resolver: Resolver,
  top: Frame,
  instance: ChipInstance,
  pin: PinKey,
): Probe | undefined => {
  const info = endpointInfo(resolver.walk.project, top.circuit, instance, pin);
  if (info === undefined) {
    return undefined;
  }
  const follow = info.role === "source" ? source : sink;
  const bitIndices = Array.from({ length: info.width }, (_unused, bit) => bit);
  const bits = mapAll(bitIndices, (bit) =>
    follow(resolver, top, { instanceId: instance.id, pin, bit }),
  );
  return bits.ok ? { instanceId: instance.id, pin, bits: bits.value } : undefined;
};

const probesOf = (resolver: Resolver, top: Frame): readonly Probe[] =>
  top.circuit.instances.flatMap((instance) =>
    pinKeys(resolver.walk.project, instance).flatMap((pin) => {
      const probe = probePin(resolver, top, instance, pin);
      return probe === undefined ? [] : [probe];
    }),
  );

/** Resolves an already-walked circuit; exported so tests can hand it walks `toNetlistSource` never builds. */
export const build = (walk: Walk, top: Frame): Outcome<Flattened> => {
  const layout = ioLayout(top.circuit);
  const resolver: Resolver = { walk, layout, memo: new Map(), active: new Map() };
  const netlist = resolveNetlist(resolver, top);
  return netlist.ok
    ? ok({ source: netlist.value, layout, probes: probesOf(resolver, top) })
    : netlist;
};

/**
 * Flattens the chip's draft, expanding every nested custom chip from its saved version, into the
 * engine's 1-bit netlist. NANDs are numbered pre-order in instance order; inputs and outputs follow
 * `ioLayout` of the draft. Buses, bit taps, SPLIT and MERGE are pure wiring; the clock is one signal.
 */
export const toNetlistSource = (project: Project, chipId: ChipId): Outcome<Flattened> => {
  const chip = findChip(project, chipId);
  if (chip === undefined) {
    return err({ type: "ChipNotFound", chipId });
  }
  const walk: Walk = {
    project,
    nands: [],
    nandIndex: new Map(),
    frames: new Map(),
    checked: new Map(),
  };
  const top: Frame = { path: [], circuit: chip.draft };
  const failure = enumerate(walk, top, [chip.id]);
  return failure === undefined ? build(walk, top) : err(failure);
};
