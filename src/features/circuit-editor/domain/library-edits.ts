import {
  createFolder as addFolder,
  deleteChip as removeChip,
  deleteFolder as removeFolder,
  fileChip as fileChipIn,
  moveFolder as relocateFolder,
  renameFolder as nameFolder,
  setStarred,
  setTags,
} from "~/features/projects";
import type { Project } from "~/features/projects";
import type { Result } from "~/shared/result";

import type { EditorAction, EditorError } from "./actions";

type Edit<Type extends EditorAction["type"]> = (
  project: Project,
  action: Extract<EditorAction, { type: Type }>,
) => Result<Project, EditorError>;

const createFolder: Edit<"createFolder"> = (project, action) =>
  addFolder(project, {
    id: action.folderId,
    name: action.name,
    ...(action.parentId === undefined ? {} : { parentId: action.parentId }),
  });

const renameFolder: Edit<"renameFolder"> = (project, action) =>
  nameFolder(project, action.folderId, action.name);

const moveFolder: Edit<"moveFolder"> = (project, action) =>
  relocateFolder(project, action.folderId, action.parentId);

const deleteFolder: Edit<"deleteFolder"> = (project, action) =>
  removeFolder(project, action.folderId);

const fileChip: Edit<"fileChip"> = (project, action) =>
  fileChipIn(project, action.chipId, action.folderId);

const starChip: Edit<"starChip"> = (project, action) =>
  setStarred(project, action.chipId, action.starred);

const tagChip: Edit<"tagChip"> = (project, action) => setTags(project, action.chipId, action.tags);

const deleteChip: Edit<"deleteChip"> = (project, action) => removeChip(project, action.chipId);

export const LIBRARY_HANDLERS = {
  createFolder,
  renameFolder,
  moveFolder,
  deleteFolder,
  fileChip,
  starChip,
  tagChip,
  deleteChip,
};
