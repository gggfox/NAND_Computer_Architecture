import type { ReactNode, RefObject } from "react";
import { useStore } from "zustand";

import type { EditorSession } from "../application/editor-session";
import { editorErrorMessage } from "../domain/editor-error-messages";
import type { InteractionCommand } from "../domain/interaction";
import { ArrayDialog } from "./ArrayDialog";
import { KeyboardHelp } from "./KeyboardHelp";
import { SelectionBar } from "./SelectionBar";
import { useFocusHostOnClose } from "./use-focus-host";

import styles from "./CircuitCanvas.module.css";

const sendCommand = (session: EditorSession, command: InteractionCommand): void => {
  session.interaction.store.getState().send({ type: "command", command });
};

/**
 * Why the last connection was refused, until the next gesture or command. The live region
 * already speaks it, so this line is hidden from assistive technology.
 */
function RefusalNotice({ session }: { readonly session: EditorSession }): ReactNode {
  const notice = useStore(session.interaction.store, (state) => state.notice);
  return notice === undefined ? undefined : (
    <p className={styles.notice} aria-hidden="true">
      {editorErrorMessage(notice)}
    </p>
  );
}

/**
 * What the interaction state opens over the canvas: the refusal notice, the selection bar, and the
 * keyboard help and Array dialogs.
 */
export function ModeOverlays({
  session,
  hostRef,
}: {
  readonly session: EditorSession;
  readonly hostRef: RefObject<HTMLElement | null>;
}): ReactNode {
  const help = useStore(session.interaction.store, (state) => state.help);
  const arraying = useStore(session.interaction.store, (state) => state.arraying);
  useFocusHostOnClose(arraying === true, hostRef);
  return (
    <>
      <RefusalNotice session={session} />
      <SelectionBar session={session} hostRef={hostRef} />
      {arraying === true ? (
        <ArrayDialog
          onArray={(request) => {
            sendCommand(session, { type: "array", request });
          }}
          onClose={() => {
            sendCommand(session, { type: "hideArray" });
          }}
        />
      ) : undefined}
      {help === true ? (
        <KeyboardHelp
          onClose={() => {
            sendCommand(session, { type: "hideHelp" });
          }}
        />
      ) : undefined}
    </>
  );
}
