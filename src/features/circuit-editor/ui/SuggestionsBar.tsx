import type { ReactNode, RefObject } from "react";
import { useStore } from "zustand";

import { m } from "~/i18n/paraglide/messages";
import { Button, Toolbar } from "~/shared/ui";

import type { EditorSession } from "../application/editor-session";
import type { InteractionCommand } from "../domain/interaction";
import { suggestionsBarVisible } from "../domain/selection-bar";
import { DockedBar } from "./DockedBar";

import styles from "./SuggestionsBar.module.css";

function send(session: EditorSession, command: InteractionCommand): void {
  session.interaction.store.getState().send({ type: "command", command });
}

function BarContent({ session }: { readonly session: EditorSession }): ReactNode {
  const count = useStore(
    session.interaction.store,
    (state) => state.suggestions?.ghosts.length ?? 0,
  );
  return (
    <Toolbar aria-label={m.suggestions_bar_label()}>
      <span className={styles.count}>{m.suggestions_bar_count({ count })}</span>
      <Button
        onPress={() => {
          send(session, { type: "acceptAllGhosts" });
        }}
      >
        {m.suggestions_accept_all()}
      </Button>
      <Button
        variant="quiet"
        onPress={() => {
          send(session, { type: "dismissGhosts" });
        }}
      >
        {m.suggestions_dismiss()}
      </Button>
    </Toolbar>
  );
}

/**
 * The suggested wires' count, with Accept all and Dismiss (D14). It docks where the selection bar
 * does, which hides while ghosts show.
 */
export function SuggestionsBar({
  session,
  hostRef,
}: {
  readonly session: EditorSession;
  readonly hostRef: RefObject<HTMLElement | null>;
}): ReactNode {
  const visible = useStore(session.interaction.store, suggestionsBarVisible);
  return visible ? (
    <DockedBar hostRef={hostRef}>
      <BarContent session={session} />
    </DockedBar>
  ) : undefined;
}
