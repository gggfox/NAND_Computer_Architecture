import type { ReactNode, RefObject } from "react";
import { useStore } from "zustand";

import { m } from "~/i18n/paraglide/messages";
import { Button } from "~/shared/ui";

import type { EditorSession } from "../application/editor-session";
import { openCircuit } from "../application/editor-store";
import { cancelPlacement, usePlacing } from "../application/library-bridge";
import { partName } from "../domain/messages";

import styles from "./CircuitCanvas.module.css";

/**
 * While a part is armed for placing: what a tap does, and Done to stop (D6). Arming and stopping
 * are spoken by the live region, so this line is not a live region itself. Done gives focus back
 * to the canvas host, since the button goes away.
 */
export function PlacingBanner({
  session,
  hostRef,
}: {
  readonly session: EditorSession;
  readonly hostRef: RefObject<HTMLElement | null>;
}): ReactNode {
  const placing = usePlacing(session);
  const name = useStore(session.editor, (state) =>
    placing === undefined ? "" : partName(state.history.present, openCircuit(state), placing),
  );
  return placing === undefined ? undefined : (
    <div className={styles.placing}>
      <p className={styles.prompt}>{m.placing_banner({ name })}</p>
      <Button
        variant="quiet"
        onPress={() => {
          cancelPlacement(session);
          hostRef.current?.focus({ preventScroll: true });
        }}
      >
        {m.placing_done()}
      </Button>
    </div>
  );
}
