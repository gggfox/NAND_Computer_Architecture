import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { useStore } from "zustand";

import { m } from "~/i18n/paraglide/messages";

import type { EditorSession } from "../application/editor-session";
import { CanvasMenus } from "./CanvasMenus";
import type { OverlayDialog } from "./CanvasMenus";
import { RecolorChipDialog, RenameChipDialog } from "./ChipDialogs";
import { KeyboardHelp } from "./KeyboardHelp";
import { PinCard } from "./PinCard";
import { WireColorDialog } from "./WireDialogs";

interface DialogProps {
  readonly session: EditorSession;
  readonly dialog: OverlayDialog;
  readonly onClose: () => void;
}

/** The open dialog; each saves as one edit (ADR 8) and closes. */
function Dialog({ session, dialog, onClose }: DialogProps): ReactNode {
  const { dispatch } = session.editor.getState();
  if (dialog.kind === "rename") {
    return (
      <RenameChipDialog
        dialog={dialog}
        onClose={onClose}
        onSave={(name) => {
          dispatch({ type: "renameChip", chipId: dialog.chipId, name });
          onClose();
        }}
      />
    );
  }
  if (dialog.kind === "recolor") {
    return (
      <RecolorChipDialog
        dialog={dialog}
        onClose={onClose}
        onSave={(color) => {
          dispatch({ type: "recolorChip", chipId: dialog.chipId, color });
          onClose();
        }}
      />
    );
  }
  return (
    <WireColorDialog
      title={m.wire_color_title()}
      color={dialog.color}
      onClose={onClose}
      onSave={(color) => {
        session.interaction.store.getState().send({
          type: "command",
          command: { type: "recolorSelection", ...(color === undefined ? {} : { color }) },
        });
        onClose();
      }}
    />
  );
}

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

/** The menus, bit picker, pin card, dialogs and keyboard help, laid over the canvas. */
export function CanvasOverlays({
  session,
  hostRef,
}: {
  readonly session: EditorSession;
  /** The canvas host, which takes focus back when a dialog closes. */
  readonly hostRef: RefObject<HTMLElement | null>;
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
      <CanvasMenus session={session} onDialog={setDialog} />
      {card === undefined ? undefined : <PinCard session={session} card={card} />}
      {dialog === undefined ? undefined : (
        <Dialog session={session} dialog={dialog} onClose={close} />
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
