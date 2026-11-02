import type { ReactNode } from "react";
import { useStore } from "zustand";

import { findChip } from "~/features/projects";
import type { WireColor } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { PointMenu } from "~/shared/ui";
import type { MenuEntry } from "~/shared/ui";

import type { EditorSession } from "../application/editor-session";
import type { CanvasMenuContext } from "../application/library-bridge";
import type { Menu } from "../domain/interaction";
import type { ChipDialog } from "./ChipDialogs";
import { BitPickerOverlay, CanvasMenuOverlay, WireMenuOverlay } from "./WireMenus";

/** A dialog over the canvas: a chip's, or the colour of the selected wires. */
export type OverlayDialog = ChipDialog | { readonly kind: "wireColor"; readonly color?: WireColor };

type ChipMenu = Extract<Menu, { kind: "chip" }>;

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
      session.editor.getState().lookInside(chip.id);
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

/** The canvas menu's content in place of the default; see `CircuitCanvas`. */
export type CanvasMenuSlot = (context: CanvasMenuContext) => ReactNode;

/** The open menu (a chip's, a wire's or the canvas's) and the bit picker. */
export function CanvasMenus({
  session,
  onDialog,
  canvasMenu,
}: {
  readonly session: EditorSession;
  readonly onDialog: (dialog: OverlayDialog) => void;
  readonly canvasMenu?: CanvasMenuSlot | undefined;
}): ReactNode {
  const menu = useStore(session.interaction.store, (state) => state.menu);
  return (
    <>
      {menu?.kind === "chip" ? (
        <ChipMenuOverlay session={session} menu={menu} onDialog={onDialog} />
      ) : undefined}
      {menu?.kind === "wire" ? (
        <WireMenuOverlay
          session={session}
          menu={menu}
          onColor={(color) => {
            onDialog({ kind: "wireColor", ...(color === undefined ? {} : { color }) });
          }}
        />
      ) : undefined}
      {menu?.kind === "canvas" ? (
        <CanvasMenuOverlay session={session} menu={menu} slot={canvasMenu} />
      ) : undefined}
      <BitPickerOverlay session={session} />
    </>
  );
}
