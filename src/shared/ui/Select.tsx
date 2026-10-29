import type { ReactNode } from "react";
import {
  Button as AriaButton,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select as AriaSelect,
  SelectValue,
} from "react-aria-components";

import styles from "./Select.module.css";

export interface SelectOption {
  readonly id: string;
  readonly label: string;
}

interface SelectProps {
  readonly label: string;
  readonly options: readonly SelectOption[];
  readonly value: string;
  readonly onChange: (key: string) => void;
  readonly isDisabled?: boolean | undefined;
}

function Options({ options }: Readonly<{ options: readonly SelectOption[] }>): ReactNode {
  return (
    <Popover className={styles.popover}>
      <ListBox className={styles.listbox}>
        {options.map((option) => (
          <ListBoxItem key={option.id} id={option.id} className={styles.option}>
            {option.label}
          </ListBoxItem>
        ))}
      </ListBox>
    </Popover>
  );
}

export function Select({
  label,
  options,
  value,
  onChange,
  isDisabled = false,
}: Readonly<SelectProps>): ReactNode {
  return (
    <AriaSelect
      className={styles.select}
      value={value}
      isDisabled={isDisabled}
      onChange={(key) => {
        if (typeof key === "string") {
          onChange(key);
        }
      }}
    >
      <Label className={styles.label}>{label}</Label>
      <AriaButton className={styles.trigger}>
        <SelectValue />
        <span aria-hidden="true" className={styles.chevron} />
      </AriaButton>
      <Options options={options} />
    </AriaSelect>
  );
}
