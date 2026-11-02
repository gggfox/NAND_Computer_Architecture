import type { ReactNode, Ref } from "react";
import { Button as AriaButton } from "react-aria-components";

import styles from "./Button.module.css";

interface ButtonProps {
  readonly children: ReactNode;
  readonly onPress?: (() => void) | undefined;
  readonly isDisabled?: boolean | undefined;
  readonly variant?: "primary" | "quiet" | undefined;
  readonly "aria-label"?: string | undefined;
  /** For a button that shows or hides a region. */
  readonly "aria-expanded"?: boolean | undefined;
  /** `submit` submits the enclosing form (Enter in a field does too). */
  readonly type?: "button" | "submit" | undefined;
  /** For a caller that moves focus to the button. */
  readonly ref?: Ref<HTMLButtonElement> | undefined;
}

export function Button({
  children,
  onPress,
  isDisabled = false,
  variant = "primary",
  "aria-label": ariaLabel,
  "aria-expanded": ariaExpanded,
  type = "button",
  ref,
}: Readonly<ButtonProps>): ReactNode {
  // With exactOptionalPropertyTypes, React Aria props reject explicit `undefined`, so spread only what is set.
  const optional = {
    ...(onPress === undefined ? {} : { onPress }),
    ...(ariaLabel === undefined ? {} : { "aria-label": ariaLabel }),
    ...(ariaExpanded === undefined ? {} : { "aria-expanded": ariaExpanded }),
    ...(ref === undefined ? {} : { ref }),
  };
  return (
    <AriaButton
      className={`${styles.button} ${variant === "primary" ? styles.primary : styles.quiet}`}
      isDisabled={isDisabled}
      type={type}
      {...optional}
    >
      {children}
    </AriaButton>
  );
}
