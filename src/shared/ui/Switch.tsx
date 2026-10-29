import type { ReactNode } from "react";
import { SwitchButton, SwitchField } from "react-aria-components";

import styles from "./Switch.module.css";

interface SwitchProps {
  readonly children: ReactNode;
  readonly isSelected: boolean;
  readonly onChange: (isSelected: boolean) => void;
  readonly isDisabled?: boolean | undefined;
}

function Track(): ReactNode {
  return (
    <span className={styles.track}>
      <span className={styles.thumb} />
    </span>
  );
}

export function Switch({
  children,
  isSelected,
  onChange,
  isDisabled = false,
}: Readonly<SwitchProps>): ReactNode {
  return (
    <SwitchField
      className={styles.field}
      isSelected={isSelected}
      onChange={onChange}
      isDisabled={isDisabled}
    >
      <SwitchButton className={styles.button}>
        <Track />
        {children}
      </SwitchButton>
    </SwitchField>
  );
}
