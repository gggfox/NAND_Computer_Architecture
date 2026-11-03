import { useLayoutEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { useStore } from "zustand";

import { m } from "~/i18n/paraglide/messages";
import { Button } from "~/shared/ui";

import type { EditorSession } from "../application/editor-session";
import { offersSelectOnAll } from "../domain/selection-bar";

import styles from "./PinCardActions.module.css";

/** The button while it shows; focus goes to the canvas host if it leaves the page holding it. */
function SelectOnAll({
  session,
  hostRef,
}: {
  readonly session: EditorSession;
  readonly hostRef: RefObject<HTMLElement | null>;
}): ReactNode {
  const boxRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = boxRef.current;
    const host = hostRef.current;
    return () => {
      if (box?.contains(document.activeElement) === true) {
        host?.focus({ preventScroll: true });
      }
    };
  }, [hostRef]);
  return (
    <div ref={boxRef} className={styles.actions}>
      <Button
        variant="quiet"
        onPress={() => {
          session.interaction.store
            .getState()
            .send({ type: "command", command: { type: "selectPinOnAll" } });
        }}
      >
        {m.pin_card_select_on_all()}
      </Button>
    </div>
  );
}

/**
 * "Select this pin on all selected chips" (D3), just below the pin card. It sits over the canvas
 * rather than on it, so a press never reaches the canvas's pointer handlers and cannot dismiss the
 * card first. Unlike the card's text it is not hidden from assistive technology.
 */
export function PinCardActions({
  session,
  hostRef,
}: {
  readonly session: EditorSession;
  readonly hostRef: RefObject<HTMLElement | null>;
}): ReactNode {
  const offered = useStore(session.interaction.store, offersSelectOnAll);
  return offered ? <SelectOnAll session={session} hostRef={hostRef} /> : undefined;
}
