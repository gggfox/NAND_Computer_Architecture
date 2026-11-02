import type { ReactNode } from "react";
import {
  Button as AriaButton,
  DropIndicator,
  GridList,
  GridListItem,
  useDragAndDrop,
} from "react-aria-components";
import type { DroppableCollectionReorderEvent, Selection } from "react-aria-components";

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
  readonly selectedKey: string | undefined;
  readonly onSelect: (key: string) => void;
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

const firstKey = (selection: Selection): string | undefined => {
  if (selection === "all") {
    return undefined;
  }
  const [key] = selection;
  return key === undefined ? undefined : String(key);
};

interface RowProps {
  readonly id: string;
  readonly text: string;
  readonly children: ReactNode;
}

function Row({ id, text, children }: Readonly<RowProps>): ReactNode {
  return (
    <GridListItem id={id} textValue={text} className={styles.row}>
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
  selectedKey,
  onSelect,
}: Readonly<ReorderListProps<Item>>): ReactNode {
  const keys = items.map((item) => getKey(item));
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (dragged) => [...dragged].map((key) => ({ "text/plain": String(key) })),
    onReorder: (event) => {
      const [moved] = event.keys;
      if (moved !== undefined) {
        onMove(String(moved), toIndexOf(keys, String(moved), event));
      }
    },
    renderDropIndicator: (target) => <DropIndicator target={target} className={styles.drop} />,
  });
  return (
    <GridList
      aria-label={label}
      className={styles.list}
      keyboardNavigationBehavior="tab"
      selectionMode="single"
      selectedKeys={selectedKey === undefined ? [] : [selectedKey]}
      onSelectionChange={(selection) => {
        const key = firstKey(selection);
        if (key !== undefined) {
          onSelect(key);
        }
      }}
      dragAndDropHooks={dragAndDropHooks}
    >
      {items.map((item) => (
        <Row key={getKey(item)} id={getKey(item)} text={getText(item)}>
          {renderRow(item)}
        </Row>
      ))}
    </GridList>
  );
}
