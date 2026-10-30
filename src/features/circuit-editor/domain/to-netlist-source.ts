import type { ChipInstance, Circuit, Wire } from "~/features/projects";
import type { NetlistSource, SignalRef } from "~/features/simulation";
import type { InstanceId, WireId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import { partOf } from "./geometry";
import type { Part } from "./geometry";

export type NetlistSourceError =
  | { readonly type: "UnsupportedPart"; readonly instanceId: InstanceId }
  | { readonly type: "UnconnectedPin"; readonly instanceId: InstanceId; readonly pin: number }
  | { readonly type: "InvalidWire"; readonly wireId: WireId };

type Outcome<T> = Result<T, NetlistSourceError>;

const SUPPORTED: ReadonlySet<Part> = new Set(["input", "nand", "output"]);
const NAND_PIN_A = 0;
const NAND_PIN_B = 1;
const SINGLE_PIN = 0;
const NAND_PIN_OUT = 2;
const NOT_FOUND = -1;

/** Pins a wire may start from: an `input` drives pin 0, a NAND drives pin 2. */
const SOURCE_PINS: Readonly<Partial<Record<Part, readonly number[]>>> = {
  input: [SINGLE_PIN],
  nand: [NAND_PIN_OUT],
};
/** Pins a wire may end on: a NAND takes pins 0 and 1, an `output` takes pin 0. */
const TARGET_PINS: Readonly<Partial<Record<Part, readonly number[]>>> = {
  nand: [NAND_PIN_A, NAND_PIN_B],
  output: [SINGLE_PIN],
};

const ofKind = (circuit: Circuit, part: Part): readonly ChipInstance[] =>
  circuit.instances.filter((item) => partOf(circuit, item) === part);

type Resolver = (instanceId: InstanceId, pin: number) => Outcome<SignalRef>;

const indexOfId = (parts: readonly ChipInstance[], id: InstanceId | undefined): number =>
  parts.findIndex((item) => item.id === id);

const createResolver =
  (circuit: Circuit, inputs: readonly ChipInstance[], nands: readonly ChipInstance[]): Resolver =>
  (instanceId, pin) => {
    const wire = circuit.wires.find(
      (candidate) => candidate.to.instanceId === instanceId && candidate.to.pin === pin,
    );
    const inputIndex = indexOfId(inputs, wire?.from.instanceId);
    if (inputIndex !== NOT_FOUND) {
      return ok({ kind: "input", index: inputIndex });
    }
    const nandIndex = indexOfId(nands, wire?.from.instanceId);
    if (nandIndex !== NOT_FOUND) {
      return ok({ kind: "nand", index: nandIndex });
    }
    return err({ type: "UnconnectedPin", instanceId, pin });
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
  resolve: Resolver,
  nand: ChipInstance,
): Outcome<NetlistSource["nands"][number]> => {
  const a = resolve(nand.id, NAND_PIN_A);
  const b = resolve(nand.id, NAND_PIN_B);
  if (!a.ok) {
    return a;
  }
  return b.ok ? ok({ a: a.value, b: b.value }) : b;
};

const endpointOk = (
  circuit: Circuit,
  table: Readonly<Partial<Record<Part, readonly number[]>>>,
  endpoint: Wire["from"],
): boolean => {
  const { pin } = endpoint;
  const part = circuit.instances.find((item) => item.id === endpoint.instanceId);
  return (
    part !== undefined &&
    typeof pin === "number" &&
    (table[partOf(circuit, part)]?.includes(pin) ?? false)
  );
};

const firstInvalidWire = (circuit: Circuit): Wire | undefined =>
  circuit.wires.find(
    (wire) =>
      !endpointOk(circuit, SOURCE_PINS, wire.from) || !endpointOk(circuit, TARGET_PINS, wire.to),
  );

const build = (circuit: Circuit): Outcome<NetlistSource> => {
  const inputs = ofKind(circuit, "input");
  const nands = ofKind(circuit, "nand");
  const resolve = createResolver(circuit, inputs, nands);
  const nandRefs = mapAll(nands, (nand) => resolveNand(resolve, nand));
  if (!nandRefs.ok) {
    return nandRefs;
  }
  const outputRefs = mapAll(ofKind(circuit, "output"), (output) => resolve(output.id, SINGLE_PIN));
  if (!outputRefs.ok) {
    return outputRefs;
  }
  return ok({ inputCount: inputs.length, nands: nandRefs.value, outputs: outputRefs.value });
};

/**
 * Each instance has one pin index space. NAND: 0 = a, 1 = b, 2 = out. An input pin piece:
 * pin 0 is its output. An output pin piece: pin 0 is its input. A wire must start on a
 * source's output pin and end on a target's input pin, otherwise `InvalidWire`.
 * Inputs, NANDs and outputs are indexed by their order in `circuit.instances`.
 */
export const toNetlistSource = (circuit: Circuit): Outcome<NetlistSource> => {
  const unsupported = circuit.instances.find((item) => !SUPPORTED.has(partOf(circuit, item)));
  if (unsupported !== undefined) {
    return err({ type: "UnsupportedPart", instanceId: unsupported.id });
  }
  const invalid = firstInvalidWire(circuit);
  return invalid === undefined ? build(circuit) : err({ type: "InvalidWire", wireId: invalid.id });
};
