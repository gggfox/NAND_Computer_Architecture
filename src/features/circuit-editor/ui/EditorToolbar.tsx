import type { ReactNode } from "react";
import { useStore } from "zustand";

import { downloadProjectFile, piece } from "~/features/projects";
import { ThemePicker } from "~/features/theming";
import type { ThemeId } from "~/features/theming";
import { m } from "~/i18n/paraglide/messages";
import { Button, FileButton, LanguagePicker, Toolbar } from "~/shared/ui";

import type { EditorSession } from "../application/editor-session";
import { openCircuit } from "../application/editor-store";
import { freeNandPosition } from "../domain/geometry";
import { CanvasButtons, ToolSwitch } from "./CanvasControls";

const PROJECT_FILE_TYPES = ["application/json", ".json"];

const themeLabels = (): Readonly<Record<ThemeId, string>> => ({
  light: m.theme_light(),
  dark: m.theme_dark(),
  "high-contrast": m.theme_high_contrast(),
});

interface EditorToolbarProps {
  readonly session: EditorSession;
  readonly onImport: (file: File) => void;
  /** Controls placed first in the toolbar, before Undo (the library's toggle). */
  readonly leading?: ReactNode;
}

/** Every edit goes through `dispatch` / `undo` / `redo` (ADR 8). */
export function EditorToolbar({ session, onImport, leading }: EditorToolbarProps): ReactNode {
  const { editor } = session;
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
    const state = editor.getState();
    const position = freeNandPosition({
      project: state.history.present,
      circuit: openCircuit(state),
    });
    state.dispatch({
      type: "placeChip",
      chipId: state.chipId,
      instance: piece({ type: "nand" }, position),
    });
  };

  return (
    <Toolbar aria-label={m.editor_toolbar_label()}>
      {leading}
      <Button isDisabled={!canUndo} onPress={handleUndo} variant="quiet">
        {m.undo()}
      </Button>
      <Button isDisabled={!canRedo} onPress={handleRedo} variant="quiet">
        {m.redo()}
      </Button>
      <Button onPress={handleAddNand}>{m.add_nand()}</Button>
      <ToolSwitch session={session} />
      <CanvasButtons session={session} />
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
