import { useStore } from "zustand";

import type { EditorSession } from "../application/editor-session";
import { editorStoreErrorMessage, simulationErrorMessage } from "../domain/messages";

/** The session's last refused edit and the simulation's error, as messages to show. */
export const useSessionErrors = (session: EditorSession): readonly string[] => {
  const lastError = useStore(session.editor, (state) => state.lastError);
  const simulationError = useStore(session.simulation, (state) => state.error);
  return [
    ...(lastError === null ? [] : [editorStoreErrorMessage(lastError)]),
    ...(simulationError === null ? [] : [simulationErrorMessage(simulationError)]),
  ];
};
