import { useEffect, useRef } from "react";
import type { RefObject } from "react";

import { takeFocusReturn } from "~/shared/focus-return";

/**
 * A dialog opened from a menu or the selection bar has no trigger left to give focus back to once
 * it closes (the menu or bar is gone), so focus goes back to the canvas host, where the keyboard
 * map is. A caller outside the canvas can name another element first (`setFocusReturn`), for
 * example the menu button of a row. That element gets focus once. The canvas rule does not change.
 */
export const useFocusHostOnClose = (
  open: boolean,
  hostRef: RefObject<HTMLElement | null>,
): void => {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!open && wasOpen.current) {
      (takeFocusReturn() ?? hostRef.current)?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open, hostRef]);
};
