import { useState } from "react";
import type { ReactNode } from "react";

import type { EditorSession } from "~/features/circuit-editor";
import { m } from "~/i18n/paraglide/messages";
import { Button } from "~/shared/ui";

import type { LibraryNode } from "../domain/library-tree";
import { runRowCommand } from "./library-dialog";
import type { LibraryDialog } from "./library-dialog";
import { LibraryDialogView } from "./LibraryDialogView";
import type { RowCommand } from "./row-menu";

import styles from "./LibraryPanel.module.css";

/** "New chip" and "New folder", above the tree. */
export function LibraryActions({
  onOpen,
}: {
  readonly onOpen: (dialog: LibraryDialog) => void;
}): ReactNode {
  return (
    <div className={styles.actions}>
      <Button
        variant="quiet"
        onPress={() => {
          onOpen({ kind: "newChip" });
        }}
      >
        {m.library_new_chip()}
      </Button>
      <Button
        variant="quiet"
        onPress={() => {
          onOpen({ kind: "newFolder" });
        }}
      >
        {m.library_new_folder()}
      </Button>
    </div>
  );
}

export interface LibraryDialogs {
  readonly open: (dialog: LibraryDialog) => void;
  readonly onCommand: (node: LibraryNode, command: RowCommand) => void;
  /** The open dialog, if any. */
  readonly view: ReactNode;
}

/** The library's dialogs and row commands; `onOpened` runs once a chip is opened in the editor. */
export const useLibraryDialogs = (session: EditorSession, onOpened: () => void): LibraryDialogs => {
  const [dialog, setDialog] = useState<LibraryDialog>();
  const close = (): void => {
    setDialog(undefined);
  };
  return {
    open: setDialog,
    onCommand: (node, command) => {
      runRowCommand({ session, openDialog: setDialog, onOpened }, node, command);
    },
    view:
      dialog === undefined ? undefined : (
        <LibraryDialogView session={session} dialog={dialog} onClose={close} onOpened={onOpened} />
      ),
  };
};
