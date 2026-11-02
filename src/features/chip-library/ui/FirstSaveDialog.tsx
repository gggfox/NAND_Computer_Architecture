import { useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";

import type { EditorSession, FirstSaveContext } from "~/features/circuit-editor";
import { findChip } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { ModalDialog } from "~/shared/ui";

import { folderIdOf, folderOptions, optionOf } from "./folder-options";
import { MoveToForm } from "./MoveToDialog";
import { useDialogDispatch } from "./use-dialog-dispatch";

import styles from "./LibraryPanel.module.css";

interface FirstSaveDialogProps {
  readonly session: EditorSession;
  readonly context: FirstSaveContext;
}

/**
 * The first save of a never-saved chip asks for its folder (D6), preset to where it is now.
 * Confirming files it if the folder changed, then saves; a refused filing is shown here.
 */
export function FirstSaveDialog({ session, context }: FirstSaveDialogProps): ReactNode {
  const project = useStore(session.editor, (state) => state.history.present);
  const { chipId, save: onSaved, cancel: onCancel } = context;
  const chip = findChip(project, chipId);
  const options = folderOptions(project);
  const [choice, setChoice] = useState(() => optionOf(options, chip?.folderId));
  const { error, run } = useDialogDispatch(session, onSaved);
  const save = (): void => {
    const folderId = folderIdOf(project, choice);
    if (folderId === chip?.folderId) {
      onSaved();
    } else {
      run({
        type: "fileChip",
        chipId,
        ...(folderId === undefined ? {} : { folderId }),
      });
    }
  };
  return (
    <ModalDialog title={m.chip_first_save_title({ name: chip?.name ?? "" })} onClose={onCancel}>
      <p className={styles.prose}>{m.chip_first_save_body()}</p>
      <MoveToForm
        options={options}
        choice={choice}
        onChoose={setChoice}
        error={error}
        onSave={save}
        onClose={onCancel}
      />
    </ModalDialog>
  );
}
