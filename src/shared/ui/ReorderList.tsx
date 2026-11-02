import type { ReactNode } from "react";
import {
  Button as AriaButton,
  DropIndicator,
  GridList,
  GridListItem,
  useDragAndDrop,
} from "react-aria-components";
import type { DroppableCollectionReorderEvent, Key, Selection } from "react-aria-components";

import styles from "./ReorderList.module.css";

interface ReorderListProps<Item> {
  /** Names the list for assistive technology. */
  readonly label: string;
  readonly items: readonly Item[];
  readonly getKey: (item: Item) => string;
  /** The row's plain text, for its accessible name and the drag handle's label. */
  readonly getText: (item: Item) => string;
  readonly renderRow: (item: Item) => ReactNode;
  /** A row was dropped at `toIndex` in the list as it would be without it. */
  readonly onMove: (key: string, toIndex: number) => void;
  /** Rows to highlight. One alone is also the list's selection; several are only highlighted. */
  readonly selectedKeys: readonly string[];
  /** The user picked a row (or, with Escape, none). */
  readonly onSelect: (keys: readonly string[]) => void;
}

/** Where `moved` lands, counted in the list without it. */
const toIndexOf = (
  keys: readonly string[],
  moved: string,
  event: DroppableCollectionReorderEvent,
): number => {
  const { target } = event;
  const from = keys.indexOf(moved);
  const at = keys.indexOf(String(target.key)) + (target.dropPosition === "after" ? 1 : 0);
  return from < at ? at - 1 : at;
};

const keysOf = (selection: Selection, all: readonly string[]): readonly string[] =>
  selection === "all" ? all : [...selection].map(String);

/** Only the dragged row moves: a drag never carries other rows along. */
const draggedOnly = (dragged: ReadonlySet<Key>): readonly string[] =>
  [...dragged].slice(0, 1).map(String);

interface RowProps {
  readonly id: string;
  readonly text: string;
  readonly highlighted: boolean;
  readonly children: ReactNode;
}

function Row({ id, text, highlighted, children }: Readonly<RowProps>): ReactNode {
  return (
    <GridListItem
      id={id}
      textValue={text}
      className={highlighted ? `${styles.row} ${styles.highlighted}` : styles.row}
    >
      <AriaButton slot="drag" className={styles.handle}>
        <span aria-hidden="true" className={styles.grip} />
      </AriaButton>
      {children}
    </GridListItem>
  );
}

/**
 * A list whose rows can be dragged into a new order, by pointer or keyboard (Enter on a row's
 * drag handle, arrows to a drop position, Enter to drop). Rows can hold their own controls:
 * Tab moves through them, and arrow keys stay inside a focused field.
 */
export function ReorderList<Item>({
  label,
  items,
  getKey,
  getText,
  renderRow,
  onMove,
  selectedKeys,
  onSelect,
}: Readonly<ReorderListProps<Item>>): ReactNode {
  const keys = items.map((item) => getKey(item));
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (dragged) => draggedOnly(dragged).map((key) => ({ "text/plain": key })),
    onReorder: (event) => {
      for (const moved of draggedOnly(event.keys)) {
        onMove(moved, toIndexOf(keys, moved, event));
      }
    },
    renderDropIndicator: (target) => <DropIndicator target={target} className={styles.drop} />,
  });
  return (
    <GridList
      aria-label={label}
      className={styles.list}
      keyboardNavigationBehavior="tab"
      /*
       * Single selection: RAC drags every selected row with the dragged one, so several selected
       * rows would travel together. Several highlighted rows are styled, not selected.
       */
      selectionMode="single"
      selectionBehavior="replace"
      selectedKeys={selectedKeys.length === 1 ? selectedKeys : []}
      onSelectionChange={(selection) => {
        onSelect(keysOf(selection, keys));
      }}
      dragAndDropHooks={dragAndDropHooks}
    >
      {items.map((item) => (
        <Row
          key={getKey(item)}
          id={getKey(item)}
          text={getText(item)}
          highlighted={selectedKeys.includes(getKey(item))}
        >
          {renderRow(item)}
        </Row>
      ))}
    </GridList>
  );
}
