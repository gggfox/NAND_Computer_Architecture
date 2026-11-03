import { useLayoutEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";

import styles from "./SelectionBar.module.css";

/**
 * A bar docked to the canvas (top centre; bottom on phones) rather than floating by the selection,
 * where it would cover the neighbouring chips a user is about to click. When the bar goes away
 * while it had focus (Delete and Array… hide the selection bar), the canvas host takes focus
 * first, before the bar leaves the page, so a keyboard user does not lose focus to the page.
 */
export function DockedBar({
  hostRef,
  children,
}: {
  /** The canvas host, which takes focus when the bar goes away while it had it. */
  readonly hostRef: RefObject<HTMLElement | null>;
  readonly children: ReactNode;
}): ReactNode {
  const barRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const bar = barRef.current;
    const host = hostRef.current;
    return () => {
      if (bar?.contains(document.activeElement) === true) {
        host?.focus({ preventScroll: true });
      }
    };
  }, [hostRef]);
  return (
    <div className={styles.dock}>
      <div ref={barRef} className={styles.bar}>
        {children}
      </div>
    </div>
  );
}
