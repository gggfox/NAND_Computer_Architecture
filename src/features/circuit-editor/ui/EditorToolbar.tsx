import type { ReactNode } from "react";

import { downloadProjectFile } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { Button, FileButton, Toolbar } from "~/shared/ui";

import type { EditorSession } from "../application/editor-session";
import { CanvasButtons, DeleteButton, ToolSwitch } from "./CanvasControls";
import { AddNandButton, HistoryButtons } from "./EditButtons";
import { MoreTools } from "./MoreTools";

import styles from "./EditorToolbar.module.css";

const PROJECT_FILE_TYPES = ["application/json", ".json"];

interface EditorToolbarProps {
  readonly session: EditorSession;
  readonly onImport: (file: File) => void;
  /** Controls placed first in the toolbar, before Undo (the library's toggle). */
  readonly leading?: ReactNode;
}

/**
 * Every edit goes through `dispatch` / `undo` / `redo` (ADR 8). On a narrow screen the toolbar
 * keeps the frequent tools and puts the others in a "more" menu; the zoom controls move to the
 * canvas's corner (`ZoomCorner`).
 */
export function EditorToolbar({ session, onImport, leading }: EditorToolbarProps): ReactNode {
  const handleExport = (): void => {
    downloadProjectFile(session.editor.getState().history.present);
  };

  return (
    <Toolbar aria-label={m.editor_toolbar_label()}>
      {leading}
      <HistoryButtons session={session} />
      <AddNandButton session={session} />
      <span className={styles.touch}>
        <ToolSwitch session={session} />
      </span>
      <DeleteButton session={session} />
      <span className={styles.wide}>
        <CanvasButtons session={session} />
        <Button onPress={handleExport} variant="quiet">
          {m.export()}
        </Button>
        <FileButton acceptedFileTypes={PROJECT_FILE_TYPES} onSelect={onImport} variant="quiet">
          {m.import()}
        </FileButton>
      </span>
      <span className={styles.narrow}>
        <MoreTools session={session} acceptedFileTypes={PROJECT_FILE_TYPES} onImport={onImport} />
      </span>
    </Toolbar>
  );
}
