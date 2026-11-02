import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { useStore } from "zustand";

import type { EditorSession } from "../application/editor-session";
import { editorErrorMessage } from "../domain/editor-error-messages";
import { CanvasMenus } from "./CanvasMenus";
import type { CanvasMenuSlot, OverlayDialog } from "./CanvasMenus";
import { KeyboardHelp } from "./KeyboardHelp";
import { OverlayDialogView } from "./OverlayDialogView";
import { PinCard } from "./PinCard";
import { PinRenamePopover } from "./PinRenamePopover";

import styles from "./CircuitCanvas.module.css";

export type { CanvasMenuSlot } from "./CanvasMenus";

/**
 * A dialog opened from a menu has no trigger left to give focus back to once it closes (the menu
 * is gone), so focus goes back to the canvas host, where the keyboard map is.
 */
const useFocusHostOnClose = (
  dialog: OverlayDialog | undefined,
  hostRef: RefObject<HTMLElement | null>,
): void => {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (dialog === undefined && wasOpen.current) {
      hostRef.current?.focus({ preventScroll: true });
    }
    wasOpen.current = dialog !== undefined;
  }, [dialog, hostRef]);
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

/** The rename popover, while a pin piece's name is being edited; one per piece, so it starts fresh. */
function RenameOverlay({
  session,
  hostRef,
}: {
  readonly session: EditorSession;
  readonly hostRef: RefObject<HTMLElement | null>;
}): ReactNode {
  const renaming = useStore(session.interaction.store, (state) => state.renaming);
  return renaming === undefined ? undefined : (
    <PinRenamePopover
      key={renaming.instanceId}
      session={session}
      renaming={renaming}
      hostRef={hostRef}
    />
  );
}

/**
 * The refusal notice, menus, bit picker, pin card, rename popover, dialogs and
 * keyboard help, over the canvas.
 */
export function CanvasOverlays({
  session,
  hostRef,
  canvasMenu,
}: {
  readonly session: EditorSession;
  /** The canvas host, which takes focus back when a dialog closes. */
  readonly hostRef: RefObject<HTMLElement | null>;
  readonly canvasMenu?: CanvasMenuSlot | undefined;
}): ReactNode {
  const card = useStore(session.interaction.store, (state) => state.card);
  const help = useStore(session.interaction.store, (state) => state.help);
  const [dialog, setDialog] = useState<OverlayDialog>();
  useFocusHostOnClose(dialog, hostRef);
  const close = (): void => {
    setDialog(undefined);
  };
  return (
    <>
      <RefusalNotice session={session} />
      <CanvasMenus session={session} onDialog={setDialog} canvasMenu={canvasMenu} />
      {card === undefined ? undefined : <PinCard session={session} card={card} />}
      <RenameOverlay session={session} hostRef={hostRef} />
      {dialog === undefined ? undefined : (
        <OverlayDialogView session={session} dialog={dialog} onClose={close} />
      )}
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
