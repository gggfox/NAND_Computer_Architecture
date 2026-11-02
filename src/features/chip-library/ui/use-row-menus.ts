import { useState } from "react";

import type { LibraryItem } from "./library-view";
import { rowCommands } from "./row-menu";
import type { RowCommand, RowMenu } from "./row-menu";

export interface RowMenus {
  /** The menu of one row: open or not, and what its commands do. */
  readonly menuOf: (item: LibraryItem) => RowMenu;
  /** Opens a row's menu from elsewhere: a right-click, or (Task 10) a long-press. */
  readonly handleOpenMenu: (item: LibraryItem) => void;
}

/** Which row's "⋯" menu is open (at most one), and where its commands go. */
export const useRowMenus = (
  onCommand: (node: LibraryItem["node"], command: RowCommand) => void,
): RowMenus => {
  const [menuKey, setMenuKey] = useState<string>();
  return {
    menuOf: (item) => ({
      isOpen: menuKey === item.key,
      onOpenChange: (isOpen) => {
        setMenuKey(isOpen ? item.key : undefined);
      },
      onCommand: (command) => {
        onCommand(item.node, command);
      },
    }),
    handleOpenMenu: (item) => {
      if (rowCommands(item.node).length > 0) {
        setMenuKey(item.key);
      }
    },
  };
};
