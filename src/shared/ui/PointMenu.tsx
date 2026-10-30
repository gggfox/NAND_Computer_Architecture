/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { useRef } from "react";
import type { ReactNode } from "react";
import { Menu, MenuItem, Popover } from "react-aria-components";

import styles from "./PointMenu.module.css";

export interface MenuEntry {
  readonly id: string;
  readonly label: string;
}

interface PointMenuProps {
  readonly label: string;
  /** Where the menu opens, in pixels from the positioned parent's top-left corner. */
  readonly point: { readonly x: number; readonly y: number };
  readonly entries: readonly MenuEntry[];
  readonly onAction: (id: string) => void;
  readonly onClose: () => void;
}

function Entries({
  label,
  entries,
  onAction,
}: Readonly<Pick<PointMenuProps, "label" | "entries" | "onAction">>): ReactNode {
  return (
    <Menu
      aria-label={label}
      className={styles.menu}
      // oxlint-disable-next-line jsx-a11y/no-autofocus -- the ARIA menu pattern moves focus into a menu as it opens
      autoFocus="first"
      onAction={(key) => {
        onAction(String(key));
      }}
    >
      {entries.map((entry) => (
        <MenuItem key={entry.id} id={entry.id} className={styles.item}>
          {entry.label}
        </MenuItem>
      ))}
    </Menu>
  );
}

/**
 * A menu opened at a point rather than from a button: a context menu for touch and mouse alike.
 * Focus moves into the menu; Escape or a press outside closes it and focus goes back.
 */
export function PointMenu({
  label,
  point,
  entries,
  onAction,
  onClose,
}: Readonly<PointMenuProps>): ReactNode {
  const anchorRef = useRef<HTMLSpanElement>(null);
  return (
    <>
      <span
        ref={anchorRef}
        className={styles.anchor}
        style={{ insetInlineStart: point.x, insetBlockStart: point.y }}
        aria-hidden="true"
      />
      <Popover
        triggerRef={anchorRef}
        isOpen
        placement="bottom start"
        className={styles.popover}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            onClose();
          }
        }}
      >
        <Entries label={label} entries={entries} onAction={onAction} />
      </Popover>
    </>
  );
}
