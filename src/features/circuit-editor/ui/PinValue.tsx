import type { ReactNode } from "react";

import type { PinDirection } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import type { PinId } from "~/shared/ids";
import { NumberField, Switch } from "~/shared/ui";

import { bitString, maxValueOf } from "../domain/pin-rows";
import type { PinRowModel } from "../domain/pin-rows";

import styles from "./PinsPanel.module.css";

interface PinValueProps {
  readonly row: PinRowModel;
  readonly direction: PinDirection;
  /** The input level set, or the output value reported; undefined when not known yet. */
  readonly value: number | undefined;
  readonly onSetInput: (pinId: PinId, value: number) => void;
}

/**
 * An output's value, read-only: decimal, plus the bits when it is wider than one. Plain text, not
 * a live region: the circuit summary already announces output changes.
 */
function OutputValue({ row, value }: Readonly<Pick<PinValueProps, "row" | "value">>): ReactNode {
  if (value === undefined) {
    return <span className={styles.value}>{m.pins_value_unknown()}</span>;
  }
  return (
    <span className={styles.value}>
      {value}
      {row.width === 1 ? undefined : (
        <span className={styles.bits}>{bitString(value, row.width)}</span>
      )}
    </span>
  );
}

/** A multi-bit input: a number field from 0 to its largest value, with the bits beside it. */
function WideInput({
  row,
  value = 0,
  onSetInput,
}: Readonly<Omit<PinValueProps, "direction">>): ReactNode {
  return (
    <span className={styles.wide}>
      <NumberField
        label={m.pins_value_label({ name: row.name })}
        isLabelHidden
        value={value}
        minValue={0}
        maxValue={maxValueOf(row.width)}
        onChange={(next) => {
          onSetInput(row.pinId, next);
        }}
      />
      <span className={styles.bits}>{bitString(value, row.width)}</span>
    </span>
  );
}

/** A switch for a 1-bit input, a number field for a wider one, and the value of an output. */
export function PinValue({
  row,
  direction,
  value,
  onSetInput,
}: Readonly<PinValueProps>): ReactNode {
  if (direction === "output") {
    return <OutputValue row={row} value={value} />;
  }
  if (row.width !== 1) {
    return <WideInput row={row} value={value} onSetInput={onSetInput} />;
  }
  return (
    <Switch
      isSelected={value === 1}
      onChange={(isSelected) => {
        onSetInput(row.pinId, isSelected ? 1 : 0);
      }}
    >
      <span className="visually-hidden">{m.pins_value_label({ name: row.name })}</span>
    </Switch>
  );
}
