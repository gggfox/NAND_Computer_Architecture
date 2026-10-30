import type { ReactNode } from "react";
import { Button as AriaButton } from "react-aria-components";

import styles from "./Button.module.css";

interface ButtonProps {
  readonly children: ReactNode;
  readonly onPress?: (() => void) | undefined;
  readonly isDisabled?: boolean | undefined;
  readonly variant?: "primary" | "quiet" | undefined;
  readonly "aria-label"?: string | undefined;
}

export function Button({
  children,
  onPress,
  isDisabled = false,
  variant = "primary",
  "aria-label": ariaLabel,
}: Readonly<ButtonProps>): ReactNode {
  // With exactOptionalPropertyTypes, React Aria props reject explicit `undefined`, so spread only what is set.
  const optional = {
    ...(onPress === undefined ? {} : { onPress }),
    ...(ariaLabel === undefined ? {} : { "aria-label": ariaLabel }),
  };
  return (
    <AriaButton
      className={`${styles.button} ${variant === "primary" ? styles.primary : styles.quiet}`}
      isDisabled={isDisabled}
      {...optional}
    >
      {children}
    </AriaButton>
  );
}
