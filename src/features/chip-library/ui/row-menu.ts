import { m } from "~/i18n/paraglide/messages";
import type { MenuEntry } from "~/shared/ui";

import type { LibraryNode } from "../domain/library-tree";

export type ChipCommand =
  | "open"
  | "rename"
  | "recolor"
  | "tags"
  | "star"
  | "unstar"
  | "moveTo"
  | "delete";
export type FolderCommand = "newFolderInside" | "renameFolder" | "moveFolder" | "deleteFolder";
export type RowCommand = ChipCommand | FolderCommand;

/** A row's "⋯" menu: opened from its button, a right-click or a long-press (D5). */
export interface RowMenu {
  readonly isOpen: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly onCommand: (command: RowCommand) => void;
}

const FOLDER_COMMANDS: readonly FolderCommand[] = [
  "newFolderInside",
  "renameFolder",
  "moveFolder",
  "deleteFolder",
];

const chipCommands = (starred: boolean): readonly ChipCommand[] => [
  "open",
  "rename",
  "recolor",
  "tags",
  starred ? "unstar" : "star",
  "moveTo",
  "delete",
];

/** A row's menu, in order. Built-in parts and the built-ins folder have none. */
export const rowCommands = (node: LibraryNode): readonly RowCommand[] => {
  if (node.type === "chip") {
    return chipCommands(node.starred);
  }
  return node.type === "folder" ? FOLDER_COMMANDS : [];
};

const LABELS: Readonly<Record<RowCommand, () => string>> = {
  open: () => m.library_menu_open(),
  rename: () => m.library_menu_rename(),
  recolor: () => m.library_menu_colour(),
  tags: () => m.library_menu_tags(),
  star: () => m.library_menu_star(),
  unstar: () => m.library_menu_unstar(),
  moveTo: () => m.library_menu_move(),
  delete: () => m.library_menu_delete(),
  newFolderInside: () => m.library_new_folder_inside(),
  renameFolder: () => m.library_menu_rename(),
  moveFolder: () => m.library_menu_move(),
  deleteFolder: () => m.library_menu_delete(),
};

/** The row's menu entries, each labelled; the entry id is the command. */
export const rowMenuEntries = (node: LibraryNode): readonly MenuEntry[] =>
  rowCommands(node).map((command) => ({ id: command, label: LABELS[command]() }));

/** The command a menu entry's id names, if the row has it. */
export const rowCommandOf = (node: LibraryNode, id: string): RowCommand | undefined =>
  rowCommands(node).find((command) => command === id);
