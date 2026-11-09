import type { ReactNode } from "react";
import { Button as AriaButton, Dialog, DialogTrigger, Popover } from "react-aria-components";

import styles from "./PopoverButton.module.css";

interface PopoverButtonProps {
  /** Names both the button and its dialog. */
  readonly label: string;
  /** What the button shows; hidden from assistive technology, which reads `label`. */
  readonly icon: ReactNode;
  /** The dialog's content. It stays open while the user presses its controls. */
  readonly children: ReactNode;
  readonly placement?: "top start" | "top end" | "bottom start" | "bottom end" | undefined;
}

/**
 * An icon button that opens a small non-modal dialog next to it. Escape or a press outside closes
 * the dialog, and focus goes back to the button.
 */
export function PopoverButton({
  label,
  icon,
  children,
  placement = "top start",
}: Readonly<PopoverButtonProps>): ReactNode {
  return (
    <DialogTrigger>
      <AriaButton aria-label={label} className={styles.button}>
        <span aria-hidden="true" className={styles.icon}>
          {icon}
        </span>
      </AriaButton>
      <Popover placement={placement} className={styles.popover}>
        <Dialog aria-label={label} className={styles.dialog}>
          {children}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
