import { useEffect, useState } from "react";

import type { RowProps } from "~/shared/ui";

import type { LibraryItem } from "./library-view";
import { createRowDrag } from "./row-drag";
import type { RowDrag, RowDragOptions } from "./row-drag";

export interface RowDragView extends Pick<RowDrag, "ghost" | "takesAction" | "isPressing"> {
  /** A row's pointer-down and, on folders, its drop marker. */
  readonly rowProps: (item: LibraryItem) => RowProps;
}

/** Row drags for one tree (see `createRowDrag`); a press still followed stops on unmount. */
export const useRowDrag = (options: RowDragOptions): RowDragView => {
  // oxlint-disable-next-line react/hook-use-state -- created once and never replaced, so there is no setter to name
  const [drag] = useState(createRowDrag);
  useEffect(() => drag.stop, [drag]);
  return {
    ghost: drag.ghost,
    takesAction: drag.takesAction,
    isPressing: drag.isPressing,
    rowProps: (item) => ({
      "data-drop-folder": item.node.type === "folder" ? item.node.folderId : undefined,
      onPointerDown: (event) => {
        drag.start(item, event.nativeEvent, options);
      },
    }),
  };
};
