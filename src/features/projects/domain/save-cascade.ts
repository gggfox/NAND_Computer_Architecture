/* oxlint-disable typescript/prefer-readonly-parameter-types -- projects and circuits carry branded ids (mutable object types); none is mutated */
import type { ChipId, PinId, WireId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import { chipsUsing, findChip, replaceChip } from "./chips";
import { containsChip, placedChips } from "./containment";
import type { BitWidth, Chip, Circuit, PinDef, PinRef, Project } from "./model";

export type SaveEffect =
  | { readonly type: "PinRemoved"; readonly pinId: PinId; readonly name: string }
  | { readonly type: "PinAdded"; readonly pinId: PinId; readonly name: string }
  | {
      readonly type: "PinRenamed";
      readonly pinId: PinId;
      readonly from: string;
      readonly to: string;
    }
  | {
      readonly type: "PinWidthChanged";
      readonly pinId: PinId;
      readonly name: string;
      readonly from: BitWidth;
      readonly to: BitWidth;
    }
  | { readonly type: "WiresRemoved"; readonly chipId: ChipId; readonly count: number };

export interface SavePlan {
  readonly project: Project;
  readonly effects: readonly SaveEffect[];
}

export type SaveError =
  | { readonly type: "ChipNotFound"; readonly chipId: ChipId }
  | { readonly type: "WouldContainItself"; readonly chipId: ChipId };

/** Pins of the old saved version that were removed or changed width in `next`. */
const brokenPins = (previous: readonly PinDef[], next: readonly PinDef[]): ReadonlySet<PinId> => {
  const widths = new Map(next.map((pin) => [pin.id, pin.width]));
  return new Set(previous.filter((pin) => widths.get(pin.id) !== pin.width).map((pin) => pin.id));
};

interface Pruned {
  readonly circuit: Circuit;
  readonly dropped: readonly WireId[];
}

/** Drops the wires that meet an instance of `chipId` on one of `broken`. */
const prune = (circuit: Circuit, chipId: ChipId, broken: ReadonlySet<PinId>): Pruned => {
  const instances = new Set(
    circuit.instances
      .filter((item) => item.kind.type === "custom" && item.kind.chipId === chipId)
      .map((item) => item.id),
  );
  const hits = (ref: PinRef): boolean =>
    instances.has(ref.instanceId) && typeof ref.pin === "string" && broken.has(ref.pin);
  const dropped = circuit.wires.filter((item) => hits(item.from) || hits(item.to));
  return dropped.length === 0
    ? { circuit, dropped: [] }
    : {
        circuit: { ...circuit, wires: circuit.wires.filter((item) => !dropped.includes(item)) },
        dropped: dropped.map((item) => item.id),
      };
};

interface Cascade {
  readonly project: Project;
  readonly removed: readonly SaveEffect[];
}

/** Prunes one parent; `undefined` when nothing in it was dropped. */
const pruneParent = (
  parent: Chip,
  chipId: ChipId,
  broken: ReadonlySet<PinId>,
): { readonly chip: Chip; readonly count: number } | undefined => {
  const saved = parent.saved === undefined ? undefined : prune(parent.saved, chipId, broken);
  const draft = prune(parent.draft, chipId, broken);
  const count = new Set([...(saved?.dropped ?? []), ...draft.dropped]).size;
  if (count === 0) {
    return undefined;
  }
  return {
    chip: {
      ...parent,
      ...(saved === undefined ? {} : { saved: saved.circuit }),
      draft: draft.circuit,
    },
    count,
  };
};

const cascade = (project: Project, chipId: ChipId, saved: Circuit): Cascade => {
  const chip = findChip(project, chipId);
  if (chip === undefined) {
    return { project, removed: [] };
  }
  const broken = brokenPins(chip.saved?.pins ?? [], saved.pins);
  const promoted = replaceChip(project, { ...chip, saved });
  const parents = broken.size === 0 ? [] : chipsUsing(promoted, chipId);
  return parents.reduce<Cascade>(
    (acc, parent) => {
      const pruned = pruneParent(parent, chipId, broken);
      return pruned === undefined
        ? acc
        : {
            project: replaceChip(acc.project, pruned.chip),
            removed: [
              ...acc.removed,
              { type: "WiresRemoved", chipId: parent.id, count: pruned.count },
            ],
          };
    },
    { project: promoted, removed: [] },
  );
};

/**
 * Makes `saved` the chip's saved version. Every direct parent drops wires, in its saved version
 * and draft, to pins that were removed or changed width. Grandparents are untouched.
 */
export const applySavedVersion = (project: Project, chipId: ChipId, saved: Circuit): Project =>
  cascade(project, chipId, saved).project;

const changedPin = (old: PinDef, next: PinDef | undefined): readonly SaveEffect[] => {
  if (next === undefined) {
    return [{ type: "PinRemoved", pinId: old.id, name: old.name }];
  }
  const renamed: readonly SaveEffect[] =
    old.name === next.name
      ? []
      : [{ type: "PinRenamed", pinId: old.id, from: old.name, to: next.name }];
  const resized: readonly SaveEffect[] =
    old.width === next.width
      ? []
      : [
          {
            type: "PinWidthChanged",
            pinId: old.id,
            name: next.name,
            from: old.width,
            to: next.width,
          },
        ];
  return [...renamed, ...resized];
};

const pinEffects = (
  previous: readonly PinDef[],
  next: readonly PinDef[],
): readonly SaveEffect[] => {
  const nextById = new Map(next.map((pin) => [pin.id, pin]));
  const known = new Set(previous.map((pin) => pin.id));
  return [
    ...previous.flatMap((pin) => changedPin(pin, nextById.get(pin.id))),
    ...next
      .filter((pin) => !known.has(pin.id))
      .map((pin): SaveEffect => ({ type: "PinAdded", pinId: pin.id, name: pin.name })),
  ];
};

/** Promotes the chip's draft to its saved version and lists what that does to the project. */
export const planSave = (project: Project, chipId: ChipId): Result<SavePlan, SaveError> => {
  const chip = findChip(project, chipId);
  if (chip === undefined) {
    return err({ type: "ChipNotFound", chipId });
  }
  const looping = placedChips(chip.draft).find(
    (placed) => placed === chipId || containsChip(project, placed, chipId),
  );
  if (looping !== undefined) {
    return err({ type: "WouldContainItself", chipId: looping });
  }
  const result = cascade(project, chipId, chip.draft);
  return ok({
    project: result.project,
    effects: [...pinEffects(chip.saved?.pins ?? [], chip.draft.pins), ...result.removed],
  });
};
