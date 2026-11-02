/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";

import type { Point } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";

import type { Ghost, GhostState } from "./row-drag";

import styles from "./DragGhost.module.css";

/** The ghost sits beside the pointer, clear of the finger, rather than under it. */
const OFFSET: Point = { x: 16, y: -40 };

const translateOf = (at: Point): string =>
  `${String(at.x + OFFSET.x)}px ${String(at.y + OFFSET.y)}px`;

/** What is being dragged: its name and colour, dimmed when it can't be dropped here. */
function GhostView({ ghost }: { readonly ghost: Ghost }): ReactNode {
  return createPortal(
    <div
      data-drag-ghost=""
      aria-hidden={ghost.isRefused ? "true" : undefined}
      className={ghost.isRefused ? `${styles.ghost} ${styles.refused}` : styles.ghost}
      style={{ translate: translateOf(ghost.at) }}
    >
      {ghost.color === undefined ? undefined : (
        <span className={styles.swatch} style={{ backgroundColor: ghost.color }} />
      )}
      <span className={styles.name}>{ghost.name}</span>
    </div>,
    document.body,
  );
}

/**
 * While a row is dragged: the ghost under the pointer, and a "Top level" drop row below the tree.
 * The row's space is kept while nothing is dragged, so no row moves under the pointer when a drag
 * begins; a phone's bottom sheet would otherwise grow and lift every row. Only this re-renders as
 * the pointer moves.
 */
export function DragLayer({ store }: { readonly store: StoreApi<GhostState> }): ReactNode {
  const { ghost } = useStore(store);
  return ghost === undefined ? (
    <div aria-hidden="true" className={`${styles.root} ${styles.idle}`} />
  ) : (
    <>
      <div data-drop-folder="" className={styles.root}>
        {m.library_top_level()}
      </div>
      <GhostView ghost={ghost} />
    </>
  );
}
