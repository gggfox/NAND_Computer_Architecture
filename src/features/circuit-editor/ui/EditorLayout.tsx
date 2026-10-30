import type { ReactNode } from "react";

import styles from "./EditorLayout.module.css";

interface EditorLayoutProps {
  readonly toolbar: ReactNode;
  readonly status: ReactNode;
  readonly canvas: ReactNode;
  readonly panel: ReactNode;
}

/** Phones (< 640 px): full-width canvas with the panel below it. Wider: the panel sits beside it. */
export function EditorLayout({ toolbar, status, canvas, panel }: EditorLayoutProps): ReactNode {
  return (
    <div className={styles.layout}>
      <div className={styles.toolbar}>{toolbar}</div>
      <div className={styles.status}>{status}</div>
      <div className={styles.canvas}>{canvas}</div>
      <aside className={styles.panel}>{panel}</aside>
    </div>
  );
}
