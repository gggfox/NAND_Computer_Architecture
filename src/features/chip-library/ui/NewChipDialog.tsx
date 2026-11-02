import { useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";

import { chipSwatches, DialogActions, DialogForm } from "~/features/circuit-editor";
import type { EditorSession } from "~/features/circuit-editor";
import { m } from "~/i18n/paraglide/messages";
import { newChipId } from "~/shared/ids";
import { ModalDialog, Select, SwatchPicker, TextInput } from "~/shared/ui";

import { folderIdOf, folderOptions, TOP_LEVEL } from "./folder-options";
import { useDialogDispatch } from "./use-dialog-dispatch";

interface NewChipDialogProps {
  readonly session: EditorSession;
  readonly onClose: () => void;
  /** The new chip was opened in the editor. */
  readonly onOpened: () => void;
}

const firstColor = (): string => chipSwatches()[0]?.color ?? "";

/**
 * A new chip: name, colour and folder. Saving creates it (draft only until its first save, D10)
 * and opens it in the editor (spec §3.2.4).
 */
export function NewChipDialog({ session, onClose, onOpened }: NewChipDialogProps): ReactNode {
  const project = useStore(session.editor, (state) => state.history.present);
  const [name, setName] = useState("");
  const [color, setColor] = useState(firstColor);
  const [folder, setFolder] = useState(TOP_LEVEL);
  const { error, run } = useDialogDispatch(session, onClose);
  const save = (): void => {
    const folderId = folderIdOf(project, folder);
    const chipId = newChipId();
    const created = run({
      type: "createChip",
      chipId,
      name,
      color,
      ...(folderId === undefined ? {} : { folderId }),
    });
    if (created && session.editor.getState().openChip(chipId).ok) {
      onOpened();
    }
  };
  return (
    <ModalDialog title={m.library_new_chip()} onClose={onClose}>
      <DialogForm onSubmit={save}>
        <TextInput
          label={m.chip_name_label()}
          value={name}
          onChange={setName}
          errorMessage={error}
          focusOnMount
        />
        <SwatchPicker
          label={m.chip_color_label()}
          swatches={chipSwatches()}
          value={color}
          onChange={setColor}
        />
        <Select
          label={m.library_folder_label()}
          options={folderOptions(project)}
          value={folder}
          onChange={setFolder}
        />
        <DialogActions onClose={onClose} />
      </DialogForm>
    </ModalDialog>
  );
}
