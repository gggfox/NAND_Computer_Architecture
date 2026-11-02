import type { ReactNode } from "react";

import { m } from "~/i18n/paraglide/messages";

import type { EditorSession } from "../application/editor-session";
import type { OverlayDialog } from "./CanvasMenus";
import { RecolorChipDialog, RenameChipDialog } from "./ChipDialogs";
import { WireColorDialog } from "./WireDialogs";

interface DialogProps {
  readonly session: EditorSession;
  readonly dialog: OverlayDialog;
  readonly onClose: () => void;
}

/** The open dialog; each saves as one edit (ADR 8) and closes. */
export function OverlayDialogView({ session, dialog, onClose }: DialogProps): ReactNode {
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
