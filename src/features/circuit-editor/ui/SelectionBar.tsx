import { useLayoutEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { useStore } from "zustand";

import { m } from "~/i18n/paraglide/messages";
import { Button, ToggleButton, Toolbar } from "~/shared/ui";

import type { EditorSession } from "../application/editor-session";
import type { InteractionCommand } from "../domain/interaction";
import { barChipActions, barVisible } from "../domain/selection-bar";

import styles from "./SelectionBar.module.css";

const ACTIONS: readonly (readonly [InteractionCommand, () => string])[] = [
  [{ type: "duplicate" }, () => m.selection_bar_duplicate()],
  [{ type: "showArray" }, () => m.selection_bar_array()],
  [{ type: "deleteSelection" }, () => m.delete_selection()],
];

function send(session: EditorSession, command: InteractionCommand): void {
  session.interaction.store.getState().send({ type: "command", command });
}

function BarButtons({ session }: { readonly session: EditorSession }): ReactNode {
  const chips = useStore(session.interaction.store, barChipActions);
  const picking = useStore(session.interaction.store, (state) => state.pinPick === true);
  return (
    <Toolbar aria-label={m.selection_bar_label()}>
      {chips
        ? ACTIONS.map(([command, label]) => (
            <Button
              key={command.type}
              variant="quiet"
              onPress={() => {
                send(session, command);
              }}
            >
              {label()}
            </Button>
          ))
        : undefined}
      <ToggleButton
        isSelected={picking}
        onChange={() => {
          send(session, { type: "togglePinPick" });
        }}
      >
        {m.selection_bar_pick_pins()}
      </ToggleButton>
    </Toolbar>
  );
}

interface BarProps {
  readonly session: EditorSession;
  /** The canvas host, which takes focus when the bar goes away while it had it. */
  readonly hostRef: RefObject<HTMLElement | null>;
}

/**
 * The bar while it shows. Delete and Array… hide it, so a keyboard user pressing one would lose
 * focus to the page; the host takes it first, before the bar leaves the page.
 */
function DockedBar({ session, hostRef }: BarProps): ReactNode {
  const barRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const bar = barRef.current;
    const host = hostRef.current;
    return () => {
      if (bar?.contains(document.activeElement) === true) {
        host?.focus({ preventScroll: true });
      }
    };
  }, [hostRef]);
  return (
    <div className={styles.dock}>
      <div ref={barRef} className={styles.bar}>
        <BarButtons session={session} />
      </div>
    </div>
  );
}

/**
 * Duplicate, Array… and Delete for the selected chips, and the Pick pins toggle, for touch and mouse users who do not know
 * the shortcuts. It is docked to the canvas (top centre; bottom on phones) rather than floating by
 * the selection, where it would cover the neighbouring chips a user is about to click.
 */
export function SelectionBar({ session, hostRef }: BarProps): ReactNode {
  const visible = useStore(session.interaction.store, barVisible);
  return visible ? <DockedBar session={session} hostRef={hostRef} /> : undefined;
}
