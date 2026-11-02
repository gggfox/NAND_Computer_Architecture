/* oxlint-disable typescript/prefer-readonly-parameter-types -- projects and nodes carry branded ids (mutable object types); none is mutated */
import type { EditorAction, PlaceableKind } from "~/features/circuit-editor";
import { isWithin } from "~/features/projects";
import type { Project } from "~/features/projects";
import type { ChipId, FolderId } from "~/shared/ids";

import type { LibraryNode } from "./library-tree";

/** What a library row drags: a chip (with its kind when it can be placed), a folder or a part. */
export type DragItem =
  | { readonly type: "chip"; readonly chipId: ChipId; readonly kind?: PlaceableKind }
  | { readonly type: "folder"; readonly folderId: FolderId }
  | { readonly type: "part"; readonly kind: PlaceableKind };

/** Where a drag is over: the canvas, a folder (no id: the top level) or nowhere useful. */
export type DropTarget =
  | { readonly type: "canvas" }
  | { readonly type: "folder"; readonly folderId?: FolderId }
  | { readonly type: "none" };

export type DropAction =
  | { readonly type: "place"; readonly kind: PlaceableKind }
  | { readonly type: "dispatch"; readonly action: EditorAction }
  | { readonly type: "refuse" };

const REFUSE: DropAction = { type: "refuse" };

const dispatch = (action: EditorAction): DropAction => ({ type: "dispatch", action });

/** What a row drags; the built-in group drags nothing. */
export const dragItemOf = (node: LibraryNode): DragItem | undefined => {
  if (node.type === "chip") {
    return node.placeable.ok
      ? { type: "chip", chipId: node.chipId, kind: { type: "custom", chipId: node.chipId } }
      : { type: "chip", chipId: node.chipId };
  }
  if (node.type === "folder") {
    return { type: "folder", folderId: node.folderId };
  }
  return node.type === "part" ? { type: "part", kind: node.kind } : undefined;
};

const onCanvas = (item: DragItem): DropAction =>
  item.type === "folder" || item.kind === undefined ? REFUSE : { type: "place", kind: item.kind };

/** Files a chip or moves a folder; a folder never goes into itself or below itself (Review Focus 1). */
const onFolder = (project: Project, item: DragItem, folderId: FolderId | undefined): DropAction => {
  const into = folderId === undefined ? {} : { folderId };
  if (item.type === "chip") {
    return dispatch({ type: "fileChip", chipId: item.chipId, ...into });
  }
  if (
    item.type === "part" ||
    (folderId !== undefined && isWithin(project, folderId, item.folderId))
  ) {
    return REFUSE;
  }
  const parent = folderId === undefined ? {} : { parentId: folderId };
  return dispatch({ type: "moveFolder", folderId: item.folderId, ...parent });
};

/** What dropping `item` on `target` does: place it, dispatch an edit, or nothing. */
export const dropAction = (project: Project, item: DragItem, target: DropTarget): DropAction => {
  if (target.type === "canvas") {
    return onCanvas(item);
  }
  return target.type === "folder" ? onFolder(project, item, target.folderId) : REFUSE;
};
