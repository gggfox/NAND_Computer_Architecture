/* oxlint-disable typescript/prefer-readonly-parameter-types -- projects and circuits carry branded ids (mutable object types); none is mutated */
import type { ChipId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import { findChip } from "./chips";
import type { Circuit, Project } from "./model";

/** The chips a circuit places directly. */
export const placedChips = (circuit: Circuit | undefined): readonly ChipId[] =>
  circuit?.instances.flatMap((item) => (item.kind.type === "custom" ? [item.kind.chipId] : [])) ??
  [];

/**
 * Whether `outer`'s saved version places `target`, directly or through other saved versions.
 * Drafts never count. Terminates on cyclic files.
 */
export const containsChip = (project: Project, outer: ChipId, target: ChipId): boolean => {
  const visited = new Set<ChipId>();
  const pending = [...placedChips(findChip(project, outer)?.saved)];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (next === target) {
      return true;
    }
    if (!visited.has(next)) {
      visited.add(next);
      pending.push(...placedChips(findChip(project, next)?.saved));
    }
  }
  return false;
};

export type PlaceError =
  | { readonly type: "ChipNotFound"; readonly chipId: ChipId }
  | { readonly type: "ChipNotSaved"; readonly chipId: ChipId }
  | { readonly type: "WouldContainItself"; readonly chipId: ChipId };

/** Whether an instance of `placed` may go into `host`'s draft. */
export const canPlace = (
  project: Project,
  host: ChipId,
  placed: ChipId,
): Result<void, PlaceError> => {
  const placedChip = findChip(project, placed);
  if (findChip(project, host) === undefined) {
    return err({ type: "ChipNotFound", chipId: host });
  }
  if (placedChip === undefined) {
    return err({ type: "ChipNotFound", chipId: placed });
  }
  if (placedChip.saved === undefined) {
    return err({ type: "ChipNotSaved", chipId: placed });
  }
  if (placed === host || containsChip(project, placed, host)) {
    return err({ type: "WouldContainItself", chipId: placed });
  }
  // oxlint-disable-next-line unicorn/no-useless-undefined -- `Result<void, …>` carries an explicit undefined value
  return ok(undefined);
};
