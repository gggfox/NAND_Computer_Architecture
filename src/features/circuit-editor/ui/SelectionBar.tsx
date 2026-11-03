import type { ReactNode } from "react";
import { useStore } from "zustand";

import { m } from "~/i18n/paraglide/messages";
import { Button, Toolbar } from "~/shared/ui";

import type { EditorSession } from "../application/editor-session";
import type { InteractionCommand } from "../domain/interaction";
import { barVisible } from "../domain/selection-bar";

import styles from "./SelectionBar.module.css";

const ACTIONS: readonly (readonly [InteractionCommand, () => string])[] = [
  [{ type: "duplicate" }, () => m.selection_bar_duplicate()],
  [{ type: "showArray" }, () => m.selection_bar_array()],
  [{ type: "deleteSelection" }, () => m.delete_selection()],
];

function BarButtons({ session }: { readonly session: EditorSession }): ReactNode {
  return (
    <Toolbar aria-label={m.selection_bar_label()}>
      {ACTIONS.map(([command, label]) => (
        <Button
          key={command.type}
          variant="quiet"
          onPress={() => {
            session.interaction.store.getState().send({ type: "command", command });
          }}
        >
          {label()}
        </Button>
      ))}
    </Toolbar>
  );
}

/**
 * Duplicate, Array… and Delete for the selected chips, for touch and mouse users who do not know
 * the shortcuts. It is docked to the canvas (top centre; bottom on phones) rather than floating by
 * the selection, where it would cover the neighbouring chips a user is about to click.
 */
export function SelectionBar({ session }: { readonly session: EditorSession }): ReactNode {
  const visible = useStore(session.interaction.store, barVisible);
  return visible ? (
    <div className={styles.dock}>
      <div className={styles.bar}>
        <BarButtons session={session} />
      </div>
    </div>
  ) : undefined;
}
