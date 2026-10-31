import type { ReactNode } from "react";
import { Label, RadioButton, RadioField, RadioGroup } from "react-aria-components";

import styles from "./SwatchPicker.module.css";

export interface Swatch {
  /** A CSS colour: `#rrggbb`, or a `var()` of a theme token. It is also the radio value. */
  readonly color: string;
  /** Its spoken name: colour is never the only cue (WCAG 1.4.1). */
  readonly label: string;
}

interface SwatchPickerProps {
  readonly label: string;
  readonly swatches: readonly Swatch[];
  readonly value: string;
  readonly onChange: (color: string) => void;
}

function SwatchOption({ swatch }: { readonly swatch: Swatch }): ReactNode {
  return (
    <RadioField value={swatch.color}>
      <RadioButton className={styles.swatch}>
        <span
          className={styles.colour}
          style={{ backgroundColor: swatch.color }}
          aria-hidden="true"
        />
        {swatch.label}
      </RadioButton>
    </RadioField>
  );
}

/** A radio group of named colour swatches. */
export function SwatchPicker({
  label,
  swatches,
  value,
  onChange,
}: Readonly<SwatchPickerProps>): ReactNode {
  return (
    <RadioGroup className={styles.group} value={value} onChange={onChange}>
      <Label className={styles.label}>{label}</Label>
      <div className={styles.grid}>
        {swatches.map((swatch) => (
          <SwatchOption key={swatch.color} swatch={swatch} />
        ))}
      </div>
    </RadioGroup>
  );
}
