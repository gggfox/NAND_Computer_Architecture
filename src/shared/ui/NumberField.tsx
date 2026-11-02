import type { ReactNode } from "react";
import {
  Button as AriaButton,
  Group,
  Input,
  Label,
  NumberField as AriaNumberField,
} from "react-aria-components";

import styles from "./NumberField.module.css";

interface NumberFieldProps {
  readonly label: string;
  readonly value: number;
  readonly minValue: number;
  readonly maxValue: number;
  readonly onChange: (value: number) => void;
}

/** Whole numbers only, without grouping, so 65535 reads as typed. */
const WHOLE: Intl.NumberFormatOptions = { maximumFractionDigits: 0, useGrouping: false };

function Stepper({ slot }: Readonly<{ slot: "decrement" | "increment" }>): ReactNode {
  return (
    <AriaButton slot={slot} className={styles.step}>
      <span aria-hidden="true" className={slot === "decrement" ? styles.minus : styles.plus} />
    </AriaButton>
  );
}

/**
 * A whole-number field with − and + buttons (each at least 24 px), clamped to its range. Arrow
 * keys step it too; clearing the field changes nothing.
 */
export function NumberField({
  label,
  value,
  minValue,
  maxValue,
  onChange,
}: Readonly<NumberFieldProps>): ReactNode {
  return (
    <AriaNumberField
      className={styles.field}
      value={value}
      minValue={minValue}
      maxValue={maxValue}
      formatOptions={WHOLE}
      onChange={(next) => {
        if (!Number.isNaN(next)) {
          onChange(next);
        }
      }}
    >
      <Label className={styles.label}>{label}</Label>
      <Group className={styles.group}>
        <Stepper slot="decrement" />
        <Input className={styles.input} />
        <Stepper slot="increment" />
      </Group>
    </AriaNumberField>
  );
}
