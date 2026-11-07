import { useState } from "react";
import type { ReactNode } from "react";

import { RecolorChipDialog, RenameChipDialog } from "~/features/circuit-editor";
import type { EditorSession, PartEntry } from "~/features/circuit-editor";
import { findChip } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import type { ChipId } from "~/shared/ids";
import { MenuButton } from "~/shared/ui";
import type { MenuEntry } from "~/shared/ui";

import { useStructureSession } from "./structure-session";

export interface PartActionsProps {
  readonly part: PartEntry;
}

/** A chip dialog that the menu opened: Rename or Recolor, with the current value. */
export type PartDialog =
  | { readonly kind: "rename"; readonly chipId: ChipId; readonly name: string }
  | { readonly kind: "recolor"; readonly chipId: ChipId; readonly color: string };

/** Delete, Duplicate, Array and the four moves for every part. Chip entries only for custom chips. */
export const partEntries = (isCustom: boolean): readonly MenuEntry[] => [
  { id: "delete", label: m.chip_menu_delete() },
  { id: "duplicate", label: m.chip_menu_duplicate() },
  { id: "array", label: m.chip_menu_array() },
  { id: "moveLeft", label: m.part_actions_move_left() },
  { id: "moveRight", label: m.part_actions_move_right() },
  { id: "moveUp", label: m.part_actions_move_up() },
  { id: "moveDown", label: m.part_actions_move_down() },
  ...(isCustom
    ? [
        { id: "rename", label: m.chip_menu_rename() },
        { id: "recolor", label: m.chip_menu_recolor() },
        { id: "lookInside", label: m.chip_menu_look_inside() },
      ]
    : []),
];

/** One grid step for each move entry: columns and rows. */
const MOVES: Readonly<Record<string, { readonly columns: number; readonly rows: number }>> = {
  moveLeft: { columns: -1, rows: 0 },
  moveRight: { columns: 1, rows: 0 },
  moveUp: { columns: 0, rows: -1 },
  moveDown: { columns: 0, rows: 1 },
};

/** Rename and Recolor give a dialog to open. Look inside runs at once. */
const customAction = (
  session: EditorSession,
  chipId: ChipId,
  id: string,
): PartDialog | undefined => {
  const editor = session.editor.getState();
  const chip = findChip(editor.history.present, chipId);
  if (chip === undefined) {
    return undefined;
  }
  if (id === "lookInside") {
    editor.lookInside(chipId);
  }
  if (id === "rename") {
    return { kind: "rename", chipId, name: chip.name };
  }
  return id === "recolor" ? { kind: "recolor", chipId, color: chip.color } : undefined;
};

type CanvasCommandType = "deleteSelection" | "duplicate" | "showArray";

/** The canvas command that each plain entry sends. */
const COMMANDS: Readonly<Record<string, CanvasCommandType>> = {
  delete: "deleteSelection",
  duplicate: "duplicate",
  array: "showArray",
};

/** Sends the canvas command for a plain entry: a move by one grid step, or a command by name. */
const sendCanvasCommand = (session: EditorSession, id: string): boolean => {
  const { send } = session.interaction.store.getState();
  const move = MOVES[id];
  const type = COMMANDS[id];
  if (move !== undefined) {
    send({ type: "command", command: { type: "nudge", ...move } });
  } else if (type !== undefined) {
    send({ type: "command", command: { type } });
  }
  return move !== undefined || type !== undefined;
};

/**
 * Runs one menu entry. It selects the part first, then sends the same command as the canvas
 * menu or the keyboard. It returns the dialog to open for Rename and Recolor.
 */
export const runPartAction = (
  session: EditorSession,
  part: PartEntry,
  id: string,
): PartDialog | undefined => {
  session.interaction.store.getState().send({
    type: "command",
    command: { type: "selectItems", instanceIds: [part.instanceId], wireIds: [] },
  });
  if (sendCanvasCommand(session, id) || part.custom === undefined) {
    return undefined;
  }
  return customAction(session, part.custom, id);
};

/** The actions of one part as a menu button; each dialog saves as one edit (ADR 8). */
export function PartActions({ part }: PartActionsProps): ReactNode {
  const session = useStructureSession();
  const [dialog, setDialog] = useState<PartDialog>();
  const close = (): void => {
    setDialog(undefined);
  };
  const { dispatch } = session.editor.getState();
  return (
    <>
      <MenuButton
        label={m.part_actions_label({ part: part.label })}
        entries={partEntries(part.custom !== undefined)}
        onAction={(id) => {
          setDialog(runPartAction(session, part, id));
        }}
      />
      {dialog?.kind === "rename" ? (
        <RenameChipDialog
          dialog={dialog}
          onClose={close}
          onSave={(name) => {
            dispatch({ type: "renameChip", chipId: dialog.chipId, name });
            close();
          }}
        />
      ) : undefined}
      {dialog?.kind === "recolor" ? (
        <RecolorChipDialog
          dialog={dialog}
          onClose={close}
          onSave={(color) => {
            dispatch({ type: "recolorChip", chipId: dialog.chipId, color });
            close();
          }}
        />
      ) : undefined}
    </>
  );
}
