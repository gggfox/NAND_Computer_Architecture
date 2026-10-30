import { findChip, findInvalidWire } from "~/features/projects";
import type { ChipInstance, Circuit, PinKey, Project, Wire } from "~/features/projects";
import type { ChipId, InstanceId, WireId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import { indexOf } from "./flatten-index";

/** `path` lists the custom-instance ids from the open chip down to the failing circuit. */
export type NetlistSourceError =
  | { readonly type: "ChipNotFound"; readonly chipId: ChipId }
  | { readonly type: "ChipNotSaved"; readonly chipId: ChipId }
  | { readonly type: "RecursiveChip"; readonly chipId: ChipId }
  | {
      readonly type: "UnconnectedPin";
      readonly path: readonly InstanceId[];
      /** Absent when an output pin has no piece to name. */
      readonly instanceId?: InstanceId;
      readonly pin: PinKey;
      readonly bit: number;
    }
  | {
      readonly type: "InvalidWire";
      readonly path: readonly InstanceId[];
      readonly wireId: WireId;
    }
  | {
      readonly type: "WireLoop";
      readonly path: readonly InstanceId[];
      readonly instanceId: InstanceId;
    };

/** One circuit being flattened: the open chip's draft, or the saved version behind a custom instance. */
export interface Frame {
  readonly path: readonly InstanceId[];
  readonly circuit: Circuit;
  /** The frame that places this one, and the custom instance it expands; absent at the top. */
  readonly host?: { readonly frame: Frame; readonly instanceId: InstanceId };
}

/** One bit of one pin of one instance. */
export interface PinBit {
  readonly instanceId: InstanceId;
  readonly pin: PinKey;
  readonly bit: number;
}

/** Everything the walk found: NANDs in pre-order, and every nested frame by path. */
export interface Walk {
  readonly project: Project;
  readonly nands: { readonly frame: Frame; readonly instanceId: InstanceId }[];
  readonly nandIndex: PerFrame<InstanceId, number>;
  /** The frame each custom instance expands to. */
  readonly frames: PerFrame<InstanceId, Frame>;
  /** `findInvalidWire` per circuit: a saved version is checked once, however often it is placed. */
  readonly checked: Map<Circuit, Wire | undefined>;
}

/**
 * Values per frame, then per key. Keying by the frame object, not its path, keeps every key short
 * however deep the frame is: path-joined keys made deep hierarchies spend most of their time
 * building and hashing strings.
 */
export type PerFrame<Key, Value> = Map<Frame, Map<Key, Value>>;

export const getIn = <Key, Value>(
  map: PerFrame<Key, Value>,
  frame: Frame,
  key: Key,
): Value | undefined => map.get(frame)?.get(key);

// oxlint-disable-next-line eslint/max-params -- the map, both keys and the value
export const setIn = <Key, Value>(
  map: PerFrame<Key, Value>,
  frame: Frame,
  key: Key,
  value: Value,
): void => {
  const inner = map.get(frame);
  if (inner === undefined) {
    map.set(frame, new Map([[key, value]]));
  } else {
    inner.set(key, value);
  }
};

export const pieceOf = (circuit: Circuit, pin: PinKey): InstanceId | undefined =>
  indexOf(circuit).pieces.get(pin);

export const unconnected = (frame: Frame, at: PinBit): NetlistSourceError => ({
  type: "UnconnectedPin",
  path: frame.path,
  ...at,
});

interface Visit {
  readonly frame: Frame;
  readonly instance: ChipInstance;
  readonly stack: readonly ChipId[];
}

const invalidWire = (walk: Walk, circuit: Circuit): Wire | undefined => {
  if (walk.checked.has(circuit)) {
    return walk.checked.get(circuit);
  }
  const invalid = findInvalidWire(walk.project, circuit);
  walk.checked.set(circuit, invalid);
  return invalid;
};

/** Checks the frame's wires, then lists its NANDs and nested frames, pre-order in instance order. */
export const enumerate = (
  walk: Walk,
  frame: Frame,
  stack: readonly ChipId[],
): NetlistSourceError | undefined => {
  const invalid = invalidWire(walk, frame.circuit);
  if (invalid !== undefined) {
    return { type: "InvalidWire", path: frame.path, wireId: invalid.id };
  }
  for (const instance of frame.circuit.instances) {
    const failure = expand(walk, { frame, instance, stack });
    if (failure !== undefined) {
      return failure;
    }
  }
  return undefined;
};

/** The saved circuit a custom instance expands to, unless it is missing, unsaved or recursive. */
const nestedCircuit = (
  project: Project,
  chipId: ChipId,
  stack: readonly ChipId[],
): Result<Circuit, NetlistSourceError> => {
  const chip = findChip(project, chipId);
  if (chip === undefined) {
    return err({ type: "ChipNotFound", chipId });
  }
  if (chip.saved === undefined) {
    return err({ type: "ChipNotSaved", chipId });
  }
  return stack.includes(chipId) ? err({ type: "RecursiveChip", chipId }) : ok(chip.saved);
};

const expandCustom = (
  walk: Walk,
  { frame, instance, stack }: Visit,
  chipId: ChipId,
): NetlistSourceError | undefined => {
  const circuit = nestedCircuit(walk.project, chipId, stack);
  if (!circuit.ok) {
    return circuit.error;
  }
  const path = [...frame.path, instance.id];
  const child: Frame = { path, circuit: circuit.value, host: { frame, instanceId: instance.id } };
  setIn(walk.frames, frame, instance.id, child);
  return enumerate(walk, child, [...stack, chipId]);
};

const expand = (walk: Walk, visit: Visit): NetlistSourceError | undefined => {
  const { frame, instance } = visit;
  if (instance.kind.type === "custom") {
    return expandCustom(walk, visit, instance.kind.chipId);
  }
  if (instance.kind.type === "nand") {
    setIn(walk.nandIndex, frame, instance.id, walk.nands.length);
    walk.nands.push({ frame, instanceId: instance.id });
  }
  return undefined;
};
