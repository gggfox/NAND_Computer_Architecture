import type { ReactNode } from "react";

import { RecolorChipDialog, RenameChipDialog } from "~/features/circuit-editor";
import type { EditorSession } from "~/features/circuit-editor";

import type { LibraryDialog } from "./library-dialog";
import { DeleteChipDialog, FolderNameDialog, TagsDialog } from "./LibraryDialogs";
import { MoveToDialog } from "./MoveToDialog";
import { NewChipDialog } from "./NewChipDialog";

interface LibraryDialogViewProps {
  readonly session: EditorSession;
  readonly dialog: LibraryDialog;
  readonly onClose: () => void;
  /** A chip was opened in the editor (New chip). */
  readonly onOpened: () => void;
}

type ChipDialog = Extract<
  LibraryDialog,
  { readonly kind: "rename" | "recolor" | "tags" | "deleteChip" }
>;

/** Rename and Colour reuse the editor's own dialogs; each saves as one edit and closes. */
function ChipDialogView({
  session,
  dialog,
  onClose,
}: Omit<LibraryDialogViewProps, "dialog" | "onOpened"> & {
  readonly dialog: ChipDialog;
}): ReactNode {
  const { dispatch } = session.editor.getState();
  const { kind, node } = dialog;
  if (kind === "rename") {
    return (
      <RenameChipDialog
        dialog={{ kind, chipId: node.chipId, name: node.name }}
        onClose={onClose}
        onSave={(name) => {
          dispatch({ type: "renameChip", chipId: node.chipId, name });
          onClose();
        }}
      />
    );
  }
  if (kind === "recolor") {
    return (
      <RecolorChipDialog
        dialog={{ kind, chipId: node.chipId, color: node.color }}
        onClose={onClose}
        onSave={(color) => {
          dispatch({ type: "recolorChip", chipId: node.chipId, color });
          onClose();
        }}
      />
    );
  }
  const Dialog = kind === "tags" ? TagsDialog : DeleteChipDialog;
  return <Dialog session={session} subject={node} onClose={onClose} />;
}

/** The open library dialog. */
export function LibraryDialogView(props: LibraryDialogViewProps): ReactNode {
  const { session, dialog, onClose, onOpened } = props;
  if (dialog.kind === "newChip") {
    return <NewChipDialog session={session} onClose={onClose} onOpened={onOpened} />;
  }
  if (dialog.kind === "newFolder") {
    return (
      <FolderNameDialog session={session} subject={{ ...dialog, kind: "new" }} onClose={onClose} />
    );
  }
  if (dialog.kind === "renameFolder") {
    return (
      <FolderNameDialog
        session={session}
        subject={{ ...dialog, kind: "rename" }}
        onClose={onClose}
      />
    );
  }
  if (dialog.kind === "move") {
    return <MoveToDialog session={session} node={dialog.node} onClose={onClose} />;
  }
  return <ChipDialogView session={session} dialog={dialog} onClose={onClose} />;
}
