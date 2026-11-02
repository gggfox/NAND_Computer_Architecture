import type { ReactNode } from "react";

import { editorErrorMessage } from "~/features/circuit-editor";
import { m } from "~/i18n/paraglide/messages";

import type { LibraryNode } from "../domain/library-tree";
import { canPlaceRow } from "../domain/placement";

import styles from "./LibraryRow.module.css";

const STAR = "★";

interface LibraryRowProps {
  readonly node: LibraryNode;
  readonly isExpanded: boolean;
  readonly isArmed: boolean;
}

const nameOf = (node: LibraryNode): string =>
  node.type === "builtins" ? m.library_builtin() : node.name;

/** A chip's colour square, or a folder's ▸ / ▾; built-in parts have neither. */
function Marker({ node, isExpanded }: Omit<LibraryRowProps, "isArmed">): ReactNode {
  if (node.type === "chip") {
    return (
      <span aria-hidden="true" className={styles.swatch} style={{ backgroundColor: node.color }} />
    );
  }
  if (node.type === "part") {
    return <span aria-hidden="true" className={styles.marker} />;
  }
  return (
    <span aria-hidden="true" className={styles.marker}>
      {isExpanded ? "▾" : "▸"}
    </span>
  );
}

/** Why the row can't be placed, if it can't. */
const reasonOf = (node: LibraryNode): string | undefined => {
  const placeable = canPlaceRow(node);
  return placeable.ok ? undefined : editorErrorMessage(placeable.error);
};

/** One library row: marker, name (truncated), why it can't be placed, and its badges. */
export function LibraryRow({ node, isExpanded, isArmed }: LibraryRowProps): ReactNode {
  const reason = reasonOf(node);
  const isChip = node.type === "chip";
  return (
    <>
      <Marker node={node} isExpanded={isExpanded} />
      <span className={styles.text}>
        <span className={styles.name}>{nameOf(node)}</span>
        {reason === undefined ? undefined : <span className={styles.reason}>{reason}</span>}
      </span>
      {isChip && node.starred ? (
        <span className={styles.star}>
          <span aria-hidden="true">{STAR}</span>
          <span className="visually-hidden">{m.library_filter_starred()}</span>
        </span>
      ) : undefined}
      {isChip && node.draftOnly ? (
        <span className={styles.badge}>{m.library_draft_only()}</span>
      ) : undefined}
      {isArmed ? <span className={styles.armed}>{m.library_armed()}</span> : undefined}
    </>
  );
}
