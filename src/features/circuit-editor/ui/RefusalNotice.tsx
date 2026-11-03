import type { ReactNode } from "react";
import { useStore } from "zustand";

import type { EditorSession } from "../application/editor-session";
import { noticeText } from "../domain/announcements-pins";
import { barVisible } from "../domain/selection-bar";

import styles from "./CircuitCanvas.module.css";

/**
 * Why the last connection was refused, until the next gesture or command. The live region
 * already speaks it, so this line is hidden from assistive technology. It moves down while the
 * selection bar holds the top of the canvas.
 */
export function RefusalNotice({ session }: { readonly session: EditorSession }): ReactNode {
  const notice = useStore(session.interaction.store, (state) => state.notice);
  const belowBar = useStore(session.interaction.store, barVisible);
  if (notice === undefined) {
    return undefined;
  }
  const editor = session.editor.getState();
  const known = { ...editor, ...session.simulation.getState() };
  return (
    <p
      className={belowBar ? `${styles.notice} ${styles.lowered}` : styles.notice}
      aria-hidden="true"
    >
      {noticeText(session.interaction.sceneOf(editor), known, notice)}
    </p>
  );
}
