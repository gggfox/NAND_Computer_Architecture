import { useState } from "react";
import type { ReactNode } from "react";

import { WireColorDialog } from "~/features/circuit-editor";
import type { WireEntry } from "~/features/circuit-editor";
import { m } from "~/i18n/paraglide/messages";
import { MenuButton } from "~/shared/ui";
import type { MenuEntry } from "~/shared/ui";

import { useStructureSession } from "./structure-session";
import { useRowFocus } from "./use-row-focus";
import { runWireAction } from "./wire-actions-run";

export interface WireActionsProps {
  readonly wire: WireEntry;
}

const entries = (): readonly MenuEntry[] => [
  { id: "delete", label: m.wire_menu_delete() },
  { id: "color", label: m.wire_menu_color() },
  { id: "reroute", label: m.wire_menu_reroute() },
  { id: "branch", label: m.wire_actions_branch() },
  { id: "bends", label: m.wire_actions_bends() },
];

/**
 * The actions menu of one wire row. Each entry selects the wire, then sends the command that the
 * canvas wire menu sends. Colour… opens the colour dialog here.
 */
export function WireActions({ wire }: WireActionsProps): ReactNode {
  const session = useStructureSession();
  const [isColorOpen, setIsColorOpen] = useState(false);
  const focus = useRowFocus(`wire:${wire.wireId}`);
  const close = (): void => {
    setIsColorOpen(false);
    focus.returnFocus();
  };
  return (
    <>
      <MenuButton
        label={m.wire_actions_label({ label: wire.label })}
        buttonRef={focus.register}
        entries={entries()}
        onAction={(id) => {
          if (id === "color") {
            setIsColorOpen(true);
          } else {
            if (id === "delete") {
              focus.prepareRemoval();
            }
            runWireAction(session, wire, { id });
          }
        }}
      />
      {isColorOpen ? (
        <WireColorDialog
          title={m.wire_color_title()}
          color={wire.color}
          onClose={close}
          onSave={(color) => {
            runWireAction(session, wire, {
              id: "color",
              ...(color === undefined ? {} : { color }),
            });
            close();
          }}
        />
      ) : undefined}
    </>
  );
}
