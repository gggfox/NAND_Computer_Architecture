import { useState } from "react";
import type { ReactNode, RefObject } from "react";
import { useStore } from "zustand";

import type { EditorSession } from "../application/editor-session";
import { CanvasMenus } from "./CanvasMenus";
import type { CanvasMenuSlot, OverlayDialog } from "./CanvasMenus";
import { ModeOverlays } from "./ModeOverlays";
import { OverlayDialogView } from "./OverlayDialogView";
import { PinCard } from "./PinCard";
import { PinCardActions } from "./PinCardActions";
import { PinRenamePopover } from "./PinRenamePopover";
import { useFocusHostOnClose } from "./use-focus-host";

export type { CanvasMenuSlot } from "./CanvasMenus";

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
 * The menus, bit picker, pin card, rename popover and chip dialogs, plus what
 * `ModeOverlays` shows, over the canvas.
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
  const [dialog, setDialog] = useState<OverlayDialog>();
  useFocusHostOnClose(dialog !== undefined, hostRef);
  const close = (): void => {
    setDialog(undefined);
  };
  return (
    <>
      <CanvasMenus session={session} onDialog={setDialog} canvasMenu={canvasMenu} />
      {card === undefined ? undefined : (
        <PinCard session={session} card={card}>
          <PinCardActions session={session} hostRef={hostRef} />
        </PinCard>
      )}
      <RenameOverlay session={session} hostRef={hostRef} />
      {dialog === undefined ? undefined : (
        <OverlayDialogView session={session} dialog={dialog} onClose={close} />
      )}
      <ModeOverlays session={session} hostRef={hostRef} />
    </>
  );
}
