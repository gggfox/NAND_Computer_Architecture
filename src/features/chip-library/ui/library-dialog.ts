import type { EditorSession, EditorState } from "~/features/circuit-editor";
import type { FolderId } from "~/shared/ids";

import type { LibraryNode } from "../domain/library-tree";
import type { ChipCommand, FolderCommand, RowCommand } from "./row-menu";

export type ChipNode = Extract<LibraryNode, { readonly type: "chip" }>;
export type FolderNode = Extract<LibraryNode, { readonly type: "folder" }>;

/** The library dialog in progress. */
export type LibraryDialog =
  | { readonly kind: "newChip" }
  | { readonly kind: "newFolder"; readonly parentId?: FolderId }
  | { readonly kind: "rename" | "recolor" | "tags" | "deleteChip"; readonly node: ChipNode }
  | { readonly kind: "renameFolder"; readonly node: FolderNode }
  | { readonly kind: "move"; readonly node: ChipNode | FolderNode };

/** What a row command reaches: the session, a dialog to open, and "a chip was opened". */
export interface CommandContext {
  readonly session: EditorSession;
  readonly openDialog: (dialog: LibraryDialog) => void;
  readonly onOpened: () => void;
}

type Run<Node, Command extends string> = Readonly<
  Record<Command, (context: CommandContext, node: Node) => void>
>;

const dispatch = (context: CommandContext): EditorState["dispatch"] =>
  context.session.editor.getState().dispatch;

const CHIP: Run<ChipNode, ChipCommand> = {
  open: (context, node) => {
    if (context.session.editor.getState().openChip(node.chipId).ok) {
      context.onOpened();
    }
  },
  rename: (context, node) => {
    context.openDialog({ kind: "rename", node });
  },
  recolor: (context, node) => {
    context.openDialog({ kind: "recolor", node });
  },
  tags: (context, node) => {
    context.openDialog({ kind: "tags", node });
  },
  star: (context, node) => {
    dispatch(context)({ type: "starChip", chipId: node.chipId, starred: true });
  },
  unstar: (context, node) => {
    dispatch(context)({ type: "starChip", chipId: node.chipId, starred: false });
  },
  moveTo: (context, node) => {
    context.openDialog({ kind: "move", node });
  },
  delete: (context, node) => {
    context.openDialog({ kind: "deleteChip", node });
  },
};

const FOLDER: Run<FolderNode, FolderCommand> = {
  newFolderInside: (context, node) => {
    context.openDialog({ kind: "newFolder", parentId: node.folderId });
  },
  renameFolder: (context, node) => {
    context.openDialog({ kind: "renameFolder", node });
  },
  moveFolder: (context, node) => {
    context.openDialog({ kind: "move", node });
  },
  // Deleting a folder loses nothing (its contents move up) and is an undo step: no confirmation.
  deleteFolder: (context, node) => {
    dispatch(context)({ type: "deleteFolder", folderId: node.folderId });
  },
};

const isChipCommand = (command: RowCommand): command is ChipCommand => Object.hasOwn(CHIP, command);
const isFolderCommand = (command: RowCommand): command is FolderCommand =>
  Object.hasOwn(FOLDER, command);

/** Runs a row's menu command: an edit now, a dialog, or opening the chip. */
export const runRowCommand = (
  context: CommandContext,
  node: LibraryNode,
  command: RowCommand,
): void => {
  if (node.type === "chip" && isChipCommand(command)) {
    CHIP[command](context, node);
  } else if (node.type === "folder" && isFolderCommand(command)) {
    FOLDER[command](context, node);
  }
};
