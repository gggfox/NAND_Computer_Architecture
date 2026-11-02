import type { ReactNode } from "react";
import { ToggleButton } from "react-aria-components";

import styles from "./FilterChip.module.css";

interface FilterChipProps {
  readonly children: ReactNode;
  readonly isSelected: boolean;
  readonly onChange: (isSelected: boolean) => void;
  /** A glyph before the label, hidden from assistive technology. */
  readonly icon?: string;
}

/** A small on/off filter (`aria-pressed`), for narrowing a list. */
export function FilterChip({
  children,
  isSelected,
  onChange,
  icon,
}: Readonly<FilterChipProps>): ReactNode {
  return (
    <ToggleButton className={styles.chip} isSelected={isSelected} onChange={onChange}>
      {icon === undefined ? undefined : <span aria-hidden="true">{icon}</span>}
      {children}
    </ToggleButton>
  );
}
