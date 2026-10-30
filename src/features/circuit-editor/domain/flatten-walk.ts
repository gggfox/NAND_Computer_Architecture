import { findChip, findInvalidWire } from "~/features/projects";
import type { ChipInstance, Circuit, PinKey, Project } from "~/features/projects";
import type { ChipId, InstanceId, WireId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

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
  readonly nandIndex: Map<string, number>;
  readonly frames: Map<string, Frame>;
}

export const keyOf = (path: readonly InstanceId[], instanceId: InstanceId): string =>
  [...path, instanceId].join("/");

export const pieceOf = (circuit: Circuit, pin: PinKey): InstanceId | undefined =>
  circuit.instances.find((item) => item.kind.type === "pin" && item.kind.pinId === pin)?.id;

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

/** Checks the frame's wires, then lists its NANDs and nested frames, pre-order in instance order. */
export const enumerate = (
  walk: Walk,
  frame: Frame,
  stack: readonly ChipId[],
): NetlistSourceError | undefined => {
  const invalid = findInvalidWire(walk.project, frame.circuit);
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
  walk.frames.set(path.join("/"), child);
  return enumerate(walk, child, [...stack, chipId]);
};

const expand = (walk: Walk, visit: Visit): NetlistSourceError | undefined => {
  const { frame, instance } = visit;
  if (instance.kind.type === "custom") {
    return expandCustom(walk, visit, instance.kind.chipId);
  }
  if (instance.kind.type === "nand") {
    walk.nandIndex.set(keyOf(frame.path, instance.id), walk.nands.length);
    walk.nands.push({ frame, instanceId: instance.id });
  }
  return undefined;
};
