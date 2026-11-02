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
}

const NONE: readonly string[] = [];

function Entries({
  label,
  entries,
  disabledIds = NONE,
  onAction,
}: Readonly<MenuButtonProps>): ReactNode {
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
export function MenuButton(props: Readonly<MenuButtonProps>): ReactNode {
  return (
    <MenuTrigger>
      <AriaButton aria-label={props.label} className={styles.button}>
        <span aria-hidden="true" className={styles.dots} />
      </AriaButton>
      <Popover placement="bottom end" className={styles.popover}>
        <Entries {...props} />
      </Popover>
    </MenuTrigger>
  );
}
