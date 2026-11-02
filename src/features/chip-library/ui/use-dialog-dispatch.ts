import { useState } from "react";

import { editorErrorMessage } from "~/features/circuit-editor";
import type { EditorAction, EditorSession } from "~/features/circuit-editor";

export interface DialogDispatch {
  /** Why the last edit was refused, translated; nothing until one is. */
  readonly error: string | undefined;
  /** Applies the edit. Done, it calls `onDone`; refused, the dialog shows why and stays open. */
  readonly run: (action: EditorAction) => boolean;
}

export const useDialogDispatch = (session: EditorSession, onDone: () => void): DialogDispatch => {
  const [error, setError] = useState<string>();
  return {
    error,
    run: (action) => {
      const result = session.editor.getState().dispatch(action);
      if (result.ok) {
        onDone();
      } else {
        setError(editorErrorMessage(result.error));
      }
      return result.ok;
    },
  };
};
