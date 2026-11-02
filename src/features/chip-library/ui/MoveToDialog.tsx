import { useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";

import { DialogActions, DialogForm } from "~/features/circuit-editor";
import type { EditorSession } from "~/features/circuit-editor";
import { m } from "~/i18n/paraglide/messages";
import { ModalDialog, Select } from "~/shared/ui";

import { currentFolder, folderIdOf, folderOptions, optionOf } from "./folder-options";
import type { ChipNode, FolderNode } from "./library-dialog";
import { useDialogDispatch } from "./use-dialog-dispatch";

interface MoveToDialogProps {
  readonly session: EditorSession;
  readonly node: ChipNode | FolderNode;
  readonly onClose: () => void;
}

/**
 * "Move to…": the keyboard and screen-reader way to file a chip or move a folder (D1). A folder is
 * never offered itself or anything below it.
 */
export function MoveToDialog({ session, node, onClose }: MoveToDialogProps): ReactNode {
  const project = useStore(session.editor, (state) => state.history.present);
  const options = folderOptions(project, node.type === "folder" ? node.folderId : undefined);
  const [choice, setChoice] = useState(() => optionOf(options, currentFolder(project, node)));
  const { run } = useDialogDispatch(session, onClose);
  const save = (): void => {
    const folderId = folderIdOf(project, choice);
    if (node.type === "chip") {
      run({
        type: "fileChip",
        chipId: node.chipId,
        ...(folderId === undefined ? {} : { folderId }),
      });
    } else {
      run({
        type: "moveFolder",
        folderId: node.folderId,
        ...(folderId === undefined ? {} : { parentId: folderId }),
      });
    }
  };
  return (
    <ModalDialog title={m.library_move_title({ name: node.name })} onClose={onClose}>
      <DialogForm onSubmit={save}>
        <Select
          label={m.library_folder_label()}
          options={options}
          value={choice}
          onChange={setChoice}
        />
        <DialogActions onClose={onClose} />
      </DialogForm>
    </ModalDialog>
  );
}
