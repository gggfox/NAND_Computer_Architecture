import { findChip, folderPath, isWithin } from "~/features/projects";
import type { Project } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import type { FolderId } from "~/shared/ids";
import type { SelectOption } from "~/shared/ui";

import type { LibraryNode } from "../domain/library-tree";

/** The option id of "Top level"; folder ids are UUIDs, so it can't clash. */
export const TOP_LEVEL = "top";

const PATH_SEPARATOR = " › ";

const byLabel = (left: SelectOption, right: SelectOption): number =>
  left.label.localeCompare(right.label, undefined, { sensitivity: "base", numeric: true });

/**
 * "Top level", then every folder by its path ("Arithmetic › Adders"), sorted. With `without`, that
 * folder and everything below it are left out: a folder can't move into itself.
 */
export const folderOptions = (project: Project, without?: FolderId): readonly SelectOption[] => [
  { id: TOP_LEVEL, label: m.library_top_level() },
  ...project.folders
    .filter((folder) => without === undefined || !isWithin(project, folder.id, without))
    .map((folder) => ({
      id: folder.id,
      label: folderPath(project, folder.id)
        .map((item) => item.name)
        .join(PATH_SEPARATOR),
    }))
    .toSorted(byLabel),
];

/** The folder an option names; "Top level", or a folder gone since, is no folder. */
export const folderIdOf = (project: Project, optionId: string): FolderId | undefined =>
  project.folders.find((folder) => folder.id === optionId)?.id;

/** The option for a folder, or "Top level" when there's none or it isn't offered. */
export const optionOf = (options: readonly SelectOption[], folderId?: FolderId): string =>
  options.find((option) => option.id === folderId)?.id ?? TOP_LEVEL;

/** Where a row is now: a chip's folder, or a folder's parent; nothing for the top level. */
export const currentFolder = (project: Project, node: LibraryNode): FolderId | undefined => {
  if (node.type === "chip") {
    return findChip(project, node.chipId)?.folderId;
  }
  return node.type === "folder"
    ? project.folders.find((folder) => folder.id === node.folderId)?.parentId
    : undefined;
};
