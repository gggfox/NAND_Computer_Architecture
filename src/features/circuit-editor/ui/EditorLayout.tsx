import type { ReactNode } from "react";

import styles from "./EditorLayout.module.css";

interface EditorLayoutProps {
  readonly toolbar: ReactNode;
  /** The open chip's header (breadcrumbs, Save): a full-width row under the toolbar (D9). */
  readonly header?: ReactNode;
  readonly status: ReactNode;
  readonly canvas: ReactNode;
  readonly panel: ReactNode;
  /**
   * The chip library: a column left of the canvas from 640 px, as wide as what it renders (none
   * while closed). On phones it renders its own sheet and takes no grid area.
   */
  readonly library?: ReactNode;
}

/**
 * Phones (< 640 px): full-width canvas with the panel below it. Wider: the library, the canvas and
 * the panel side by side.
 */
export function EditorLayout({
  toolbar,
  header,
  status,
  canvas,
  panel,
  library,
}: EditorLayoutProps): ReactNode {
  return (
    <div className={styles.layout}>
      <div className={styles.toolbar}>{toolbar}</div>
      <div className={styles.header}>{header}</div>
      <div className={styles.status}>{status}</div>
      <div className={styles.library}>{library}</div>
      <div className={styles.canvas}>{canvas}</div>
      <aside className={styles.panel}>{panel}</aside>
    </div>
  );
}
