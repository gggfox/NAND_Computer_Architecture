import { useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";

import { findChip } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { PointMenu } from "~/shared/ui";
import type { MenuEntry } from "~/shared/ui";

import type { EditorSession } from "../application/editor-session";
import type { ChipMenu } from "../domain/interaction";
import { RecolorChipDialog, RenameChipDialog } from "./ChipDialogs";
import type { ChipDialog } from "./ChipDialogs";
import { KeyboardHelp } from "./KeyboardHelp";
import { PinCard } from "./PinCard";

/** Delete for every part; the chip-definition actions only for custom chips (spec §5.1). */
const entriesFor = (custom: boolean): readonly MenuEntry[] => [
  { id: "delete", label: m.chip_menu_delete() },
  ...(custom
    ? [
        { id: "rename", label: m.chip_menu_rename() },
        { id: "recolor", label: m.chip_menu_recolor() },
        { id: "lookInside", label: m.chip_menu_look_inside() },
      ]
    : []),
];

/** The chip definition behind a menu's instance, when it is a custom chip. */
const customChipOf = (session: EditorSession, menu: ChipMenu) => {
  const editor = session.editor.getState();
  const instance = session.interaction
    .sceneOf(editor)
    .circuit.instances.find((item) => item.id === menu.instanceId);
  return instance?.kind.type === "custom"
    ? findChip(editor.history.present, instance.kind.chipId)
    : undefined;
};

function ChipMenuOverlay({
  session,
  menu,
  onDialog,
}: {
  readonly session: EditorSession;
  readonly menu: ChipMenu;
  readonly onDialog: (dialog: ChipDialog) => void;
}): ReactNode {
  const chip = customChipOf(session, menu);
  const { send } = session.interaction.store.getState();
  // The menu may already be closed by its action; escaping then would clear the selection.
  const closeMenu = (): void => {
    if (session.interaction.store.getState().menu !== undefined) {
      send({ type: "command", command: { type: "escape" } });
    }
  };
  const onAction = (id: string): void => {
    // Close first: a dialog opened by the action does not make the popover report its own close.
    closeMenu();
    if (id === "delete") {
      send({ type: "command", command: { type: "deleteSelection" } });
    } else if (chip !== undefined && id === "rename") {
      onDialog({ kind: "rename", chipId: chip.id, name: chip.name });
    } else if (chip !== undefined && id === "recolor") {
      onDialog({ kind: "recolor", chipId: chip.id, color: chip.color });
    } else if (chip !== undefined) {
      session.editor.getState().openChip(chip.id);
    }
  };
  return (
    <PointMenu
      label={m.chip_menu_label()}
      point={menu.screen}
      entries={entriesFor(chip !== undefined)}
      onAction={onAction}
      onClose={closeMenu}
    />
  );
}

/** The chip menu, pin card, chip dialogs and keyboard help, laid over the canvas. */
export function CanvasOverlays({ session }: { readonly session: EditorSession }): ReactNode {
  const menu = useStore(session.interaction.store, (state) => state.menu);
  const card = useStore(session.interaction.store, (state) => state.card);
  const help = useStore(session.interaction.store, (state) => state.help);
  const [dialog, setDialog] = useState<ChipDialog>();
  const close = (): void => {
    setDialog(undefined);
  };
  const { dispatch } = session.editor.getState();
  return (
    <>
      {menu === undefined ? undefined : (
        <ChipMenuOverlay session={session} menu={menu} onDialog={setDialog} />
      )}
      {card === undefined ? undefined : <PinCard session={session} card={card} />}
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
      {help === true ? (
        <KeyboardHelp
          onClose={() => {
            session.interaction.store
              .getState()
              .send({ type: "command", command: { type: "hideHelp" } });
          }}
        />
      ) : undefined}
    </>
  );
}
