import type { ReactNode } from "react";
import { useStore } from "zustand";

import type { WireColor } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { PointMenu } from "~/shared/ui";
import type { MenuEntry } from "~/shared/ui";

import type { EditorSession } from "../application/editor-session";
import type { BitPick, InteractionCommand, Menu } from "../domain/interaction";

type WireMenu = Extract<Menu, { kind: "wire" }>;
type CanvasMenu = Extract<Menu, { kind: "canvas" }>;

const sender =
  (session: EditorSession) =>
  (command: InteractionCommand): void => {
    session.interaction.store.getState().send({ type: "command", command });
  };

/**
 * Closes an overlay with Escape, unless its action already closed it: escaping then would go on
 * to clear the selection, or cancel the armed pin.
 */
const closer = (session: EditorSession, isOpen: () => boolean) => (): void => {
  if (isOpen()) {
    sender(session)({ type: "escape" });
  }
};

/** Several items selected, this wire among them: the menu acts on all of them (Colour…, Delete). */
const isMany = (session: EditorSession, menu: WireMenu): boolean => {
  const { instances, wires } = session.interaction.store.getState().selection;
  return wires.has(menu.wireId) && instances.size + wires.size > 1;
};

const wireEntries = (many: boolean): readonly MenuEntry[] => [
  { id: "color", label: m.wire_menu_color() },
  ...(many
    ? []
    : [
        { id: "bends", label: m.wire_menu_bends() },
        { id: "reroute", label: m.wire_menu_reroute() },
        { id: "branch", label: m.wire_menu_branch() },
      ]),
  { id: "delete", label: m.wire_menu_delete() },
];

const wireCommand = (id: string, menu: WireMenu): InteractionCommand | undefined => {
  const { wireId } = menu;
  const commands: Readonly<Record<string, InteractionCommand>> = {
    bends: { type: "editBends", wireId },
    reroute: { type: "rerouteWire", wireId },
    branch: { type: "branch", wireId },
    delete: { type: "deleteSelection" },
  };
  return commands[id];
};

/** The wire menu; Colour… asks the parent for the colour dialog, with the wire's own colour. */
export function WireMenuOverlay({
  session,
  menu,
  onColor,
}: {
  readonly session: EditorSession;
  readonly menu: WireMenu;
  readonly onColor: (color: WireColor | undefined) => void;
}): ReactNode {
  const many = isMany(session, menu);
  const close = closer(session, () => session.interaction.store.getState().menu !== undefined);
  const onAction = (id: string): void => {
    // Close first: the commands below act on the selection, which Escape on a menu keeps.
    close();
    const command = wireCommand(id, menu);
    if (command !== undefined) {
      sender(session)(command);
      return;
    }
    const wire = session.interaction
      .sceneOf(session.editor.getState())
      .circuit.wires.find((item) => item.id === menu.wireId);
    onColor(wire?.color);
  };
  return (
    <PointMenu
      label={m.wire_menu_label()}
      point={menu.screen}
      entries={wireEntries(many)}
      onAction={onAction}
      onClose={close}
    />
  );
}

/** The canvas menu: Tidy wires (also on the toolbar, so the menu is never the only path). */
export function CanvasMenuOverlay({
  session,
  menu,
}: {
  readonly session: EditorSession;
  readonly menu: CanvasMenu;
}): ReactNode {
  const close = closer(session, () => session.interaction.store.getState().menu !== undefined);
  return (
    <PointMenu
      label={m.canvas_menu_label()}
      point={menu.screen}
      entries={[{ id: "tidy", label: m.canvas_menu_tidy() }]}
      onAction={() => {
        close();
        sender(session)({ type: "tidyWires" });
      }}
      onClose={close}
    />
  );
}

/** The bit picker: which bit of the bus end a new wire takes. Escape keeps the pin armed. */
export function BitPickerOverlay({ session }: { readonly session: EditorSession }): ReactNode {
  const pick: BitPick | undefined = useStore(session.interaction.store, (state) => state.bitPick);
  if (pick === undefined) {
    return undefined;
  }
  return (
    <PointMenu
      label={m.bit_picker_label()}
      point={pick.screen}
      entries={pick.bits.map((bit) => ({ id: String(bit), label: m.bit_picker_bit({ bit }) }))}
      onAction={(id) => {
        sender(session)({ type: "pickBit", bit: Number(id) });
      }}
      onClose={closer(session, () => session.interaction.store.getState().bitPick !== undefined)}
    />
  );
}
