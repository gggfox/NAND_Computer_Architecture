import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * A dialog opened from a menu or the selection bar has no trigger left to give focus back to once
 * it closes (the menu or bar is gone), so focus goes back to the canvas host, where the keyboard
 * map is.
 */
export const useFocusHostOnClose = (
  open: boolean,
  hostRef: RefObject<HTMLElement | null>,
): void => {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!open && wasOpen.current) {
      hostRef.current?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open, hostRef]);
};
