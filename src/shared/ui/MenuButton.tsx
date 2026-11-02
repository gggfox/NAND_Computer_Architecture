import type { ReactNode } from "react";
import { Button as AriaButton, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";

import type { MenuEntry } from "./PointMenu";

import styles from "./MenuButton.module.css";

interface MenuButtonProps {
  /** Names both the button and its menu. */
  readonly label: string;
  readonly entries: readonly MenuEntry[];
  readonly disabledIds?: readonly string[];
  readonly onAction: (id: string) => void;
  /** Opens the menu from elsewhere too (a right-click on its row); leave out for a plain button. */
  readonly isOpen?: boolean | undefined;
  readonly onOpenChange?: ((isOpen: boolean) => void) | undefined;
}

const NONE: readonly string[] = [];

function Entries({
  label,
  entries,
  disabledIds = NONE,
  onAction,
}: Readonly<Omit<MenuButtonProps, "isOpen" | "onOpenChange">>): ReactNode {
  return (
    <Menu
      aria-label={label}
      className={styles.menu}
      disabledKeys={disabledIds}
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

/** A "more" button (⋯) that opens a menu of actions; focus goes back to it when the menu closes. */
export function MenuButton({
  isOpen,
  onOpenChange,
  ...props
}: Readonly<MenuButtonProps>): ReactNode {
  // With exactOptionalPropertyTypes, React Aria props reject explicit `undefined`, so spread only what is set.
  const controlled = {
    ...(isOpen === undefined ? {} : { isOpen }),
    ...(onOpenChange === undefined ? {} : { onOpenChange }),
  };
  return (
    <MenuTrigger {...controlled}>
      <AriaButton aria-label={props.label} className={styles.button}>
        <span aria-hidden="true" className={styles.dots} />
      </AriaButton>
      <Popover placement="bottom end" className={styles.popover}>
        <Entries {...props} />
      </Popover>
    </MenuTrigger>
  );
}
