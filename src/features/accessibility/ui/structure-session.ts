import { createContext, useContext } from "react";

import type { EditorSession } from "~/features/circuit-editor";

/**
 * The open editor session, for the action menus in the structure view. `StructureView` provides
 * it, so `StructureBody` and the rows keep plain props, and each menu reads the session here.
 */
export const StructureSessionContext = createContext<EditorSession | undefined>(undefined);

/** The session that `StructureView` provides. A menu outside the view is a programming error. */
export const useStructureSession = (): EditorSession => {
  const session = useContext(StructureSessionContext);
  if (session === undefined) {
    throw new Error("useStructureSession needs a StructureView (StructureSessionContext) above it");
  }
  return session;
};
