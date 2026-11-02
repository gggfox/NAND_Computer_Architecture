import type { ReactNode } from "react";

import {
  armPlacement,
  cancelPlacement,
  placeAtCentre,
  usePlacing,
} from "~/features/circuit-editor";
import type { EditorSession } from "~/features/circuit-editor";
import { m } from "~/i18n/paraglide/messages";
import { TreeView, useKeyboardModality } from "~/shared/ui";

import { isArmed, kindOfNode } from "../domain/placement";
import { toggleKey } from "../domain/tree-expansion";
import type { Expansion, LibraryItem, LibraryView } from "./library-view";
import { LibraryRow } from "./LibraryRow";

interface LibraryTreeProps {
  readonly session: EditorSession;
  readonly view: LibraryView;
  readonly onExpand: (expansion: Expansion) => void;
  /** A row was armed by pointer or touch: on phones the sheet gets out of the canvas's way. */
  readonly onArmed: () => void;
}

/** The key of the row whose kind is armed, if it is shown. */
const findArmed = (
  items: readonly LibraryItem[],
  placing: Parameters<typeof isArmed>[1],
): string | undefined => {
  for (const item of items) {
    const found = isArmed(item.node, placing) ? item.key : findArmed(item.children ?? [], placing);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
};

/** The library's folder tree: a folder's action opens or closes it; a part's places or arms it. */
export function LibraryTree({ session, view, onExpand, onArmed }: LibraryTreeProps): ReactNode {
  const placing = usePlacing(session);
  const isKeyboard = useKeyboardModality();
  const armed = findArmed(view.items, placing);

  const onAction = (item: LibraryItem): void => {
    const kind = kindOfNode(item.node);
    if (kind === undefined) {
      onExpand(view.expand(toggleKey(view.expanded, item.key)));
    } else if (item.key === armed) {
      cancelPlacement(session);
    } else if (isKeyboard) {
      placeAtCentre(session, kind);
    } else {
      armPlacement(session, kind);
      onArmed();
    }
  };

  return (
    <TreeView
      label={m.library_tree_label()}
      items={view.items}
      expandedKeys={view.expanded}
      onExpandedChange={(keys) => {
        onExpand(view.expand(keys));
      }}
      disabledKeys={view.disabled}
      onAction={onAction}
      currentKey={armed}
      emptyText={m.library_no_results()}
      renderRow={(item) => (
        <LibraryRow
          node={item.node}
          isExpanded={view.expanded.has(item.key)}
          isArmed={item.key === armed}
        />
      )}
    />
  );
}
