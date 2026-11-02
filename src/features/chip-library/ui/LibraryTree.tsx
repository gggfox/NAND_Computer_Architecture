import type { ReactNode } from "react";

import type { EditorSession } from "~/features/circuit-editor";
import { m } from "~/i18n/paraglide/messages";
import { TreeView } from "~/shared/ui";

import { DragLayer } from "./DragGhost";
import type { Expansion, LibraryView } from "./library-view";
import { LibraryRow } from "./LibraryRow";
import { useRowAction } from "./use-row-action";
import { useRowDrag } from "./use-row-drag";
import { useRowMenus } from "./use-row-menus";

interface LibraryTreeProps {
  readonly session: EditorSession;
  readonly view: LibraryView;
  readonly onExpand: (expansion: Expansion) => void;
  /** A row was armed by pointer or touch, or dropped on the canvas: on phones the sheet goes. */
  readonly onArmed: () => void;
  /** A drag began (true) or ended (false): on phones the sheet tucks away meanwhile. */
  readonly onTuck: (isTucked: boolean) => void;
  /** A command picked from a row's menu. */
  readonly onCommand: Parameters<typeof useRowMenus>[0];
}

/**
 * The library's folder tree: a folder's action opens or closes it; a part's places or arms it.
 * Rows drag onto the canvas or onto folder rows (D1).
 */
export function LibraryTree({ onTuck, onCommand, ...props }: LibraryTreeProps): ReactNode {
  const { session, view, onExpand, onArmed } = props;
  const { armed, onAction } = useRowAction(props);
  const menus = useRowMenus(onCommand);
  const drag = useRowDrag({ session, onMenu: menus.handleOpenMenu, onTuck, onPlaced: onArmed });
  return (
    <>
      <TreeView
        label={m.library_tree_label()}
        items={view.items}
        expandedKeys={view.expanded}
        onExpandedChange={(keys) => {
          onExpand(view.expand(keys));
        }}
        unavailable={view.unavailable}
        onAction={(item) => {
          if (drag.takesAction()) {
            onAction(item);
          }
        }}
        currentKey={armed}
        emptyText={m.library_no_results()}
        onRowContextMenu={(item) => {
          // A touch long-press opens the menu itself on release, unless it became a drag.
          if (!drag.isPressing()) {
            menus.handleOpenMenu(item);
          }
        }}
        rowProps={drag.rowProps}
        renderRow={(item) => (
          <LibraryRow
            node={item.node}
            isExpanded={view.expanded.has(item.key)}
            isArmed={item.key === armed}
            menu={menus.menuOf(item)}
          />
        )}
      />
      <DragLayer store={drag.ghost} />
    </>
  );
}
