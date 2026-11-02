import {
  armPlacement,
  cancelPlacement,
  placeAtCentre,
  usePlacing,
} from "~/features/circuit-editor";
import type { EditorSession, PlaceableKind } from "~/features/circuit-editor";
import { useKeyboardModality } from "~/shared/ui";

import { isArmed, kindOfNode } from "../domain/placement";
import { toggleKey } from "../domain/tree-expansion";
import type { Expansion, LibraryItem, LibraryView } from "./library-view";

interface RowActionOptions {
  readonly session: EditorSession;
  readonly view: LibraryView;
  readonly onExpand: (expansion: Expansion) => void;
  /** A row was armed by pointer or touch: on phones the sheet gets out of the canvas's way. */
  readonly onArmed: () => void;
}

interface RowAction {
  /** The key of the row whose kind is armed, if it is shown. */
  readonly armed: string | undefined;
  readonly onAction: (item: LibraryItem) => void;
}

const findArmed = (
  items: readonly LibraryItem[],
  placing: PlaceableKind | undefined,
): string | undefined => {
  for (const item of items) {
    const found = isArmed(item.node, placing) ? item.key : findArmed(item.children ?? [], placing);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
};

/**
 * A row's action: a folder opens or closes; the armed row disarms; from the keyboard a part is
 * placed at the centre, by pointer or touch it is armed.
 */
export const useRowAction = ({ session, view, onExpand, onArmed }: RowActionOptions): RowAction => {
  const isKeyboard = useKeyboardModality();
  const armed = findArmed(view.items, usePlacing(session));
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
  return { armed, onAction };
};
