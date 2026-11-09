import type { ReactNode } from "react";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components";

import styles from "./SegmentedControl.module.css";

export interface SegmentOption {
  readonly id: string;
  /** Text, or text with a visual variant that keeps the text as the accessible name. */
  readonly label: ReactNode;
}

interface SegmentedControlProps {
  readonly label: string;
  readonly options: readonly SegmentOption[];
  readonly value: string;
  readonly onChange: (id: string) => void;
}

/** One-of-several toggle buttons, like the hand and arrow tools of a drawing app. */
export function SegmentedControl({
  label,
  options,
  value,
  onChange,
}: Readonly<SegmentedControlProps>): ReactNode {
  return (
    <ToggleButtonGroup
      className={styles.group}
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[value]}
      onSelectionChange={(keys) => {
        const [key] = keys;
        if (typeof key === "string") {
          onChange(key);
        }
      }}
    >
      {options.map((option) => (
        <ToggleButton key={option.id} id={option.id} className={styles.segment}>
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
