/* oxlint-disable typescript/prefer-readonly-parameter-types -- projects and folders carry branded ids (mutable object types); none is mutated */
import type { FolderId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { Chip, Folder, Project } from "./model";

export type FolderError =
  | { readonly type: "FolderNotFound"; readonly folderId: FolderId }
  | { readonly type: "DuplicateFolder"; readonly folderId: FolderId }
  | { readonly type: "FolderIntoItself"; readonly folderId: FolderId }
  | { readonly type: "EmptyName" };

const findFolder = (project: Project, folderId: FolderId): Folder | undefined =>
  project.folders.find((folder) => folder.id === folderId);

/** The chain from the top level down to `folderId`; empty for the top level or an unknown id. */
export const folderPath = (project: Project, folderId: FolderId | undefined): readonly Folder[] => {
  const path: Folder[] = [];
  const seen = new Set<FolderId>();
  let current = folderId === undefined ? undefined : findFolder(project, folderId);
  while (current !== undefined && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId === undefined ? undefined : findFolder(project, current.parentId);
  }
  return path;
};

/** True when `folderId` is `ancestorId` or sits somewhere below it. */
export const isWithin = (project: Project, folderId: FolderId, ancestorId: FolderId): boolean =>
  folderId === ancestorId || folderPath(project, folderId).some((item) => item.id === ancestorId);

const withFolders = (project: Project, folders: readonly Folder[]): Project => ({
  ...project,
  folders,
});

const notFound = (folderId: FolderId): FolderError => ({ type: "FolderNotFound", folderId });

export const createFolder = (
  project: Project,
  folder: { readonly id: FolderId; readonly name: string; readonly parentId?: FolderId },
): Result<Project, FolderError> => {
  const name = folder.name.trim();
  if (name === "") {
    return err({ type: "EmptyName" });
  }
  if (findFolder(project, folder.id) !== undefined) {
    return err({ type: "DuplicateFolder", folderId: folder.id });
  }
  if (folder.parentId !== undefined && findFolder(project, folder.parentId) === undefined) {
    return err(notFound(folder.parentId));
  }
  const created: Folder =
    folder.parentId === undefined
      ? { id: folder.id, name }
      : { id: folder.id, name, parentId: folder.parentId };
  return ok(withFolders(project, [...project.folders, created]));
};

const updateFolder = (
  project: Project,
  folderId: FolderId,
  update: (folder: Folder) => Folder,
): Project =>
  withFolders(
    project,
    project.folders.map((folder) => (folder.id === folderId ? update(folder) : folder)),
  );

export const renameFolder = (
  project: Project,
  folderId: FolderId,
  name: string,
): Result<Project, FolderError> => {
  const trimmed = name.trim();
  if (trimmed === "") {
    return err({ type: "EmptyName" });
  }
  const target = findFolder(project, folderId);
  if (target === undefined) {
    return err(notFound(folderId));
  }
  return target.name === trimmed
    ? ok(project)
    : ok(updateFolder(project, folderId, (folder) => ({ ...folder, name: trimmed })));
};

const moveUnder = (folder: Folder, parentId: FolderId | undefined): Folder => {
  const { parentId: _dropped, ...rest } = folder;
  return parentId === undefined ? rest : { ...rest, parentId };
};

/** Why `folderId` can't move under `parentId`, if it can't. */
const parentRefusal = (
  project: Project,
  folderId: FolderId,
  parentId: FolderId,
): FolderError | undefined => {
  if (findFolder(project, parentId) === undefined) {
    return notFound(parentId);
  }
  return isWithin(project, parentId, folderId) ? { type: "FolderIntoItself", folderId } : undefined;
};

/** `parentId` undefined moves the folder to the top level. */
export const moveFolder = (
  project: Project,
  folderId: FolderId,
  parentId: FolderId | undefined,
): Result<Project, FolderError> => {
  const target = findFolder(project, folderId);
  if (target === undefined) {
    return err(notFound(folderId));
  }
  if (target.parentId === parentId) {
    return ok(project);
  }
  const refusal = parentId === undefined ? undefined : parentRefusal(project, folderId, parentId);
  return refusal === undefined
    ? ok(updateFolder(project, folderId, (folder) => moveUnder(folder, parentId)))
    : err(refusal);
};

const liftChip = (chip: Chip, from: FolderId, to: FolderId | undefined): Chip => {
  if (chip.folderId !== from) {
    return chip;
  }
  const { folderId: _dropped, ...rest } = chip;
  return to === undefined ? rest : { ...rest, folderId: to };
};

/** Subfolders and chips move up to the deleted folder's parent; no chip is removed. */
export const deleteFolder = (
  project: Project,
  folderId: FolderId,
): Result<Project, FolderError> => {
  const target = findFolder(project, folderId);
  if (target === undefined) {
    return err(notFound(folderId));
  }
  const folders = project.folders
    .filter((folder) => folder.id !== folderId)
    .map((folder) => (folder.parentId === folderId ? moveUnder(folder, target.parentId) : folder));
  const chips = project.chips.map((chip) => liftChip(chip, folderId, target.parentId));
  return ok({ ...project, folders, chips });
};
