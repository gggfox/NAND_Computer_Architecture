import { useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";

import { DialogActions, DialogForm } from "~/features/circuit-editor";
import type { EditorSession } from "~/features/circuit-editor";
import { m } from "~/i18n/paraglide/messages";
import { ModalDialog, Select } from "~/shared/ui";
import type { SelectOption } from "~/shared/ui";

import { currentFolder, folderIdOf, folderOptions, optionOf } from "./folder-options";
import type { ChipNode, FolderNode } from "./library-dialog";
import { useDialogDispatch } from "./use-dialog-dispatch";

import styles from "./LibraryPanel.module.css";

interface MoveToDialogProps {
  readonly session: EditorSession;
  readonly node: ChipNode | FolderNode;
  readonly onClose: () => void;
}

interface MoveToFormProps {
  readonly options: readonly SelectOption[];
  readonly choice: string;
  readonly onChoose: (choice: string) => void;
  /** Why the move was refused, translated; nothing until one is. */
  readonly error: string | undefined;
  readonly onSave: () => void;
  readonly onClose: () => void;
}

/** The folder picker; a refusal is shown here and the dialog stays open. */
export function MoveToForm(props: MoveToFormProps): ReactNode {
  return (
    <DialogForm onSubmit={props.onSave}>
      <Select
        label={m.library_folder_label()}
        options={props.options}
        value={props.choice}
        onChange={props.onChoose}
      />
      {props.error === undefined ? undefined : (
        <p role="alert" className={styles.error}>
          {props.error}
        </p>
      )}
      <DialogActions onClose={props.onClose} />
    </DialogForm>
  );
}

/**
 * "Move to…": the keyboard and screen-reader way to file a chip or move a folder (D1). A folder is
 * never offered itself or anything below it.
 */
export function MoveToDialog({ session, node, onClose }: MoveToDialogProps): ReactNode {
  const project = useStore(session.editor, (state) => state.history.present);
  const options = folderOptions(project, node.type === "folder" ? node.folderId : undefined);
  const [choice, setChoice] = useState(() => optionOf(options, currentFolder(project, node)));
  const { error, run } = useDialogDispatch(session, onClose);
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
      <MoveToForm
        options={options}
        choice={choice}
        onChoose={setChoice}
        error={error}
        onSave={save}
        onClose={onClose}
      />
    </ModalDialog>
  );
}
