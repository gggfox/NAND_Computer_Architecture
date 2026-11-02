/* oxlint-disable typescript/prefer-readonly-parameter-types -- projects and chips carry branded ids (mutable object types); none is mutated */
import type { ChipId, FolderId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import { chipsUsing, findChip, replaceChip } from "./chips";
import type { Chip, Project } from "./model";

export type CatalogError =
  | { readonly type: "ChipNotFound"; readonly chipId: ChipId }
  | { readonly type: "FolderNotFound"; readonly folderId: FolderId }
  | { readonly type: "ChipInUse"; readonly chipId: ChipId; readonly usedByName: string }
  | { readonly type: "LastChip" };

/** Trims tags and drops empty ones; duplicates are compared ignoring case and the first spelling stays. */
export const normalizeTags = (tags: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const tag of tags) {
    const trimmed = tag.trim();
    const key = trimmed.toLowerCase();
    if (trimmed !== "" && !seen.has(key)) {
      seen.add(key);
      kept.push(trimmed);
    }
  }
  return kept;
};

const edit = (
  project: Project,
  chipId: ChipId,
  update: (chip: Chip) => Chip,
): Result<Project, CatalogError> => {
  const chip = findChip(project, chipId);
  return chip === undefined
    ? err({ type: "ChipNotFound", chipId })
    : ok(replaceChip(project, update(chip)));
};

/** `folderId` undefined files the chip at the top level. */
export const fileChip = (
  project: Project,
  chipId: ChipId,
  folderId: FolderId | undefined,
): Result<Project, CatalogError> => {
  if (folderId !== undefined && !project.folders.some((folder) => folder.id === folderId)) {
    return err({ type: "FolderNotFound", folderId });
  }
  return edit(project, chipId, ({ folderId: _dropped, ...rest }) =>
    folderId === undefined ? rest : { ...rest, folderId },
  );
};

export const setStarred = (
  project: Project,
  chipId: ChipId,
  starred: boolean,
): Result<Project, CatalogError> => edit(project, chipId, (chip) => ({ ...chip, starred }));

export const setTags = (
  project: Project,
  chipId: ChipId,
  tags: readonly string[],
): Result<Project, CatalogError> =>
  edit(project, chipId, (chip) => ({ ...chip, tags: normalizeTags(tags) }));

/** Refused while another chip places it (saved or draft) and for the last chip. */
export const deleteChip = (project: Project, chipId: ChipId): Result<Project, CatalogError> => {
  if (findChip(project, chipId) === undefined) {
    return err({ type: "ChipNotFound", chipId });
  }
  const [parent] = chipsUsing(project, chipId);
  if (parent !== undefined) {
    return err({ type: "ChipInUse", chipId, usedByName: parent.name });
  }
  const [first, ...rest] = project.chips.filter((chip) => chip.id !== chipId);
  if (first === undefined) {
    return err({ type: "LastChip" });
  }
  const chips = [first, ...rest] as const;
  return ok({
    ...project,
    chips,
    lastOpenedChipId: project.lastOpenedChipId === chipId ? first.id : project.lastOpenedChipId,
  });
};
