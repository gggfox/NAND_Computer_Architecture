/* oxlint-disable typescript/prefer-readonly-parameter-types -- projects and chips carry branded ids (mutable object types); none is mutated */
import type { ChipId } from "~/shared/ids";

import type { Chip, Circuit, Project } from "./model";

export const findChip = (project: Project, chipId: ChipId): Chip | undefined =>
  project.chips.find((chip) => chip.id === chipId);

/** Swaps in `chip` by id; the project is returned unchanged when no chip has that id. */
export const replaceChip = (project: Project, chip: Chip): Project =>
  project.chips.some((item) => item.id === chip.id)
    ? { ...project, chips: project.chips.map((item) => (item.id === chip.id ? chip : item)) }
    : project;

const places = (circuit: Circuit | undefined, chipId: ChipId): boolean =>
  circuit?.instances.some((item) => item.kind.type === "custom" && item.kind.chipId === chipId) ??
  false;

/** The direct parents of `chipId`: chips whose saved version or draft places it. */
export const chipsUsing = (project: Project, chipId: ChipId): readonly Chip[] =>
  project.chips.filter((chip) => places(chip.saved, chipId) || places(chip.draft, chipId));
