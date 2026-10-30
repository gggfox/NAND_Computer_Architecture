import type { ReactNode } from "react";
import { useStore } from "zustand";

import { downloadProjectFile } from "~/features/projects";
import { ThemePicker } from "~/features/theming";
import type { ThemeId } from "~/features/theming";
import { m } from "~/i18n/paraglide/messages";
import { newInstanceId } from "~/shared/ids";
import { Button, FileButton, LanguagePicker, Toolbar } from "~/shared/ui";

import type { EditorStore } from "../application/editor-store";
import { freeNandPosition } from "../domain/geometry";

const PROJECT_FILE_TYPES = ["application/json", ".json"];

const themeLabels = (): Readonly<Record<ThemeId, string>> => ({
  light: m.theme_light(),
  dark: m.theme_dark(),
  "high-contrast": m.theme_high_contrast(),
});

interface EditorToolbarProps {
  readonly editor: EditorStore;
  readonly onImport: (file: File) => void;
}

/** Every edit goes through `dispatch` / `undo` / `redo` (ADR 8). */
export function EditorToolbar({ editor, onImport }: EditorToolbarProps): ReactNode {
  const canUndo = useStore(editor, (state) => state.history.past.length > 0);
  const canRedo = useStore(editor, (state) => state.history.future.length > 0);

  const handleUndo = (): void => {
    editor.getState().undo();
  };
  const handleRedo = (): void => {
    editor.getState().redo();
  };
  const handleExport = (): void => {
    downloadProjectFile(editor.getState().history.present);
  };
  const handleAddNand = (): void => {
    const { dispatch, history } = editor.getState();
    dispatch({
      type: "placeChip",
      instance: {
        id: newInstanceId(),
        kind: { type: "builtin", builtin: "nand" },
        position: freeNandPosition(history.present.rootCircuit),
      },
    });
  };

  return (
    <Toolbar aria-label={m.editor_toolbar_label()}>
      <Button isDisabled={!canUndo} onPress={handleUndo} variant="quiet">
        {m.undo()}
      </Button>
      <Button isDisabled={!canRedo} onPress={handleRedo} variant="quiet">
        {m.redo()}
      </Button>
      <Button onPress={handleAddNand}>{m.add_nand()}</Button>
      <Button onPress={handleExport} variant="quiet">
        {m.export()}
      </Button>
      <FileButton acceptedFileTypes={PROJECT_FILE_TYPES} onSelect={onImport} variant="quiet">
        {m.import()}
      </FileButton>
      <ThemePicker label={m.theme_label()} optionLabels={themeLabels()} />
      <LanguagePicker />
    </Toolbar>
  );
}
