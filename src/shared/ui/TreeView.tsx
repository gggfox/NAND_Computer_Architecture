import type { ReactNode } from "react";
import { Collection, Tree, TreeItem, TreeItemContent } from "react-aria-components";
import type { Key } from "react-aria-components";

import styles from "./TreeView.module.css";

export interface TreeNode {
  readonly key: string;
  /** The row's plain text, for typeahead and its accessible name. */
  readonly textValue: string;
  readonly children?: readonly TreeNode[];
}

/** A node whose children are nodes of its own type. */
type OwnNode<Node> = TreeNode & { readonly children?: readonly Node[] };

interface TreeViewProps<Node extends OwnNode<Node>> {
  /** Names the tree for assistive technology. */
  readonly label: string;
  readonly items: readonly Node[];
  readonly expandedKeys: ReadonlySet<string>;
  readonly onExpandedChange: (keys: ReadonlySet<string>) => void;
  /** Enter, a click or a tap on a row that isn't unavailable. */
  readonly onAction: (node: Node) => void;
  readonly renderRow: (node: Node) => ReactNode;
  /**
   * Rows that take no action, each with the reason, which is read out with the row. They are greyed
   * out but not `aria-disabled`: that would disable the row's own controls (its menu button) too.
   * They stay focusable, so those controls remain reachable from the keyboard.
   */
  readonly unavailable?: ReadonlyMap<string, string>;
  /** Shown in place of the rows when there are none. */
  readonly emptyText?: string;
  /** The row marked `aria-current`. */
  readonly currentKey?: string | undefined;
  /** A right-click on a row, in place of the browser's own menu. */
  readonly onRowContextMenu?: ((node: Node) => void) | undefined;
}

const NONE: ReadonlyMap<string, string> = new Map();

/**
 * RAC rows don't pass ARIA props through, and RAC's own disabled rows can't take focus, so these
 * states are set on the row element here.
 */
const mark = (element: HTMLDivElement | null, name: string, value: string | undefined): void => {
  if (value === undefined) {
    element?.removeAttribute(name);
  } else {
    element?.setAttribute(name, value);
  }
};

const indexed = <Node extends OwnNode<Node>>(
  nodes: readonly Node[],
  into: Map<string, Node>,
): Map<string, Node> => {
  for (const node of nodes) {
    into.set(node.key, node);
    indexed(node.children ?? [], into);
  }
  return into;
};

interface RowRenderer<Node> {
  readonly renderRow: (node: Node) => ReactNode;
  readonly currentKey: string | undefined;
  readonly unavailable: ReadonlyMap<string, string>;
  readonly onRowContextMenu: ((node: Node) => void) | undefined;
}

/** Renders one node and, through RAC's `Collection`, its children; indented by level. */
const itemRenderer = <Node extends OwnNode<Node>>({
  renderRow,
  currentKey,
  unavailable,
  onRowContextMenu,
}: RowRenderer<Node>): ((node: Node) => ReactNode) => {
  // RAC re-renders a cached row only when its item or these change.
  const dependencies = [renderRow, currentKey, unavailable, onRowContextMenu];
  const renderItem = (node: Node): ReactNode => (
    <TreeItem
      id={node.key}
      textValue={node.textValue}
      className={styles.item}
      ref={(element: HTMLDivElement | null) => {
        mark(element, "aria-current", node.key === currentKey ? "true" : undefined);
        mark(element, "data-unavailable", unavailable.has(node.key) ? "true" : undefined);
        mark(element, "aria-description", unavailable.get(node.key));
      }}
    >
      <TreeItemContent>
        {({ level }) => (
          <div
            className={styles.row}
            style={{ paddingInlineStart: `${String(level - 1)}rem` }}
            onContextMenu={(event) => {
              if (onRowContextMenu !== undefined) {
                event.preventDefault();
                onRowContextMenu(node);
              }
            }}
          >
            {renderRow(node)}
          </div>
        )}
      </TreeItemContent>
      <Collection items={node.children ?? []} dependencies={dependencies}>
        {renderItem}
      </Collection>
    </TreeItem>
  );
  return renderItem;
};

/**
 * A tree of rows that open and close (arrow keys, or a row's action), with typeahead. Expansion is
 * controlled by the caller, which can show a different set while it filters.
 */
export function TreeView<Node extends OwnNode<Node>>({
  label,
  items,
  expandedKeys,
  onExpandedChange,
  onAction,
  renderRow,
  unavailable = NONE,
  emptyText,
  currentKey,
  onRowContextMenu,
}: Readonly<TreeViewProps<Node>>): ReactNode {
  const byKey = indexed(items, new Map<string, Node>());
  return (
    <Tree
      aria-label={label}
      className={styles.tree}
      items={items}
      dependencies={[renderRow, currentKey, unavailable, onRowContextMenu]}
      expandedKeys={expandedKeys}
      onExpandedChange={(keys) => {
        onExpandedChange(new Set([...keys].map(String)));
      }}
      onAction={(key: Key) => {
        const node = byKey.get(String(key));
        if (node !== undefined && !unavailable.has(node.key)) {
          onAction(node);
        }
      }}
      {...(emptyText === undefined
        ? {}
        : { renderEmptyState: () => <p className={styles.empty}>{emptyText}</p> })}
    >
      {itemRenderer({ renderRow, currentKey, unavailable, onRowContextMenu })}
    </Tree>
  );
}
