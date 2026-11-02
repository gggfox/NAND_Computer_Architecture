import { findChip } from "~/features/projects";
import type { Project } from "~/features/projects";
import type { ChipId } from "~/shared/ids";

/** The chips opened with Look inside, outermost first; the last one is the open chip. */
export type Trail = readonly ChipId[];

/** Appends `chipId`; when it is already in the trail, cuts back to it. */
export const trailInto = (trail: Trail, chipId: ChipId): Trail => {
  const at = trail.indexOf(chipId);
  return at === -1 ? [...trail, chipId] : trail.slice(0, at + 1);
};

/** The trail up to and including `index`; the same trail when `index` is out of range. */
export const trailTo = (trail: Trail, index: number): Trail =>
  Number.isInteger(index) && index >= 0 && index < trail.length ? trail.slice(0, index + 1) : trail;

/** Drops chips missing from `project`; `[open]` when the result no longer ends at `open` (D7). */
export const repairTrail = (trail: Trail, project: Project, open: ChipId): Trail => {
  const kept = trail.filter((id) => findChip(project, id) !== undefined);
  return kept.at(-1) === open ? kept : [open];
};
