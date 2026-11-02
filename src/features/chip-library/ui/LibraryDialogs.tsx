import { useState } from "react";
import type { ReactNode } from "react";

import { DialogActions, DialogForm } from "~/features/circuit-editor";
import type { EditorSession } from "~/features/circuit-editor";
import { m } from "~/i18n/paraglide/messages";
import { newFolderId } from "~/shared/ids";
import { Button, ModalDialog, TextInput } from "~/shared/ui";

import type { ChipNode, FolderNode } from "./library-dialog";
import { useDialogDispatch } from "./use-dialog-dispatch";

import styles from "./LibraryPanel.module.css";

interface DialogProps<Subject> {
  readonly session: EditorSession;
  readonly subject: Subject;
  readonly onClose: () => void;
}

const TAG_SEPARATOR = ",";

/** The chip's tags as one comma-separated field; empty ones and repeats are dropped on save (D13). */
export function TagsDialog({ session, subject, onClose }: DialogProps<ChipNode>): ReactNode {
  const [text, setText] = useState(subject.tags.join(`${TAG_SEPARATOR} `));
  const { error, run } = useDialogDispatch(session, onClose);
  return (
    <ModalDialog title={m.library_tags_title({ name: subject.name })} onClose={onClose}>
      <DialogForm
        onSubmit={() => {
          run({ type: "tagChip", chipId: subject.chipId, tags: text.split(TAG_SEPARATOR) });
        }}
      >
        <TextInput
          label={m.library_tags_label()}
          description={m.library_tags_hint()}
          value={text}
          onChange={setText}
          errorMessage={error}
        />
        <DialogActions onClose={onClose} />
      </DialogForm>
    </ModalDialog>
  );
}

/**
 * Deleting a chip resets undo (D3), so it asks first. A refusal ("Used in Full adder", or the last
 * chip) is shown here and the dialog stays open.
 */
export function DeleteChipDialog({ session, subject, onClose }: DialogProps<ChipNode>): ReactNode {
  const { error, run } = useDialogDispatch(session, onClose);
  return (
    <ModalDialog title={m.library_delete_title({ name: subject.name })} onClose={onClose}>
      <p>{m.library_delete_body()}</p>
      {error === undefined ? undefined : (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <Button variant="quiet" onPress={onClose}>
          {m.dialog_cancel()}
        </Button>
        <Button
          onPress={() => {
            run({ type: "deleteChip", chipId: subject.chipId });
          }}
        >
          {m.library_delete_confirm()}
        </Button>
      </div>
    </ModalDialog>
  );
}

/** What a folder name dialog edits: a new folder (maybe inside another), or an existing one. */
export type FolderNameSubject =
  | { readonly kind: "new"; readonly parentId?: FolderNode["folderId"] }
  | { readonly kind: "rename"; readonly node: FolderNode };

/** Names a new folder, or renames one. Folder names are trimmed and must not be empty (D13). */
export function FolderNameDialog({
  session,
  subject,
  onClose,
}: DialogProps<FolderNameSubject>): ReactNode {
  const isNew = subject.kind === "new";
  const [name, setName] = useState(isNew ? "" : subject.node.name);
  const { error, run } = useDialogDispatch(session, onClose);
  const save = (): void => {
    if (subject.kind === "rename") {
      run({ type: "renameFolder", folderId: subject.node.folderId, name });
      return;
    }
    const parent = subject.parentId === undefined ? {} : { parentId: subject.parentId };
    run({ type: "createFolder", folderId: newFolderId(), name, ...parent });
  };
  return (
    <ModalDialog
      title={isNew ? m.library_new_folder() : m.library_rename_folder()}
      onClose={onClose}
    >
      <DialogForm onSubmit={save}>
        <TextInput
          label={m.library_folder_name()}
          value={name}
          onChange={setName}
          errorMessage={error}
          focusOnMount
        />
        <DialogActions onClose={onClose} />
      </DialogForm>
    </ModalDialog>
  );
}
