import type { ReactNode } from "react";
import { ToggleButton as AriaToggleButton } from "react-aria-components";

import styles from "./Button.module.css";

interface ToggleButtonProps {
  readonly children: ReactNode;
  readonly isSelected: boolean;
  readonly onChange: (isSelected: boolean) => void;
}

/** A button that stays pressed while on (`aria-pressed`), in the `Button` styles: filled while on, outlined while off. */
export function ToggleButton({
  children,
  isSelected,
  onChange,
}: Readonly<ToggleButtonProps>): ReactNode {
  return (
    <AriaToggleButton
      className={isSelected ? `${styles.button} ${styles.primary}` : styles.button}
      isSelected={isSelected}
      onChange={onChange}
    >
      {children}
    </AriaToggleButton>
  );
}
