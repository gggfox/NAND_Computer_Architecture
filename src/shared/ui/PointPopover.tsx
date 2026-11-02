/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { useRef } from "react";
import type { ReactNode } from "react";
import { Dialog, Popover } from "react-aria-components";

import styles from "./PointPopover.module.css";

interface PointPopoverProps {
  /** Names the dialog. */
  readonly label: string;
  /** Where it opens, in pixels from the positioned parent's top-left corner. */
  readonly point: { readonly x: number; readonly y: number };
  readonly onClose: () => void;
  readonly children: ReactNode;
}

/**
 * A dialog opened at a point, like `PointMenu`, for content richer than a menu (a search field
 * and lists). Escape or a press outside closes it and focus goes back.
 */
export function PointPopover({
  label,
  point,
  onClose,
  children,
}: Readonly<PointPopoverProps>): ReactNode {
  const anchorRef = useRef<HTMLSpanElement>(null);
  return (
    <>
      <span
        ref={anchorRef}
        className={styles.anchor}
        style={{ insetInlineStart: point.x, insetBlockStart: point.y }}
        aria-hidden="true"
      />
      <Popover
        triggerRef={anchorRef}
        isOpen
        placement="bottom start"
        className={styles.popover}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            onClose();
          }
        }}
      >
        <Dialog aria-label={label} className={styles.dialog}>
          {children}
        </Dialog>
      </Popover>
    </>
  );
}
