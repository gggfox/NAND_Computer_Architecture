import type { ReactNode } from "react";
import { Input, Label, TextField } from "react-aria-components";

import styles from "./TextInput.module.css";

interface TextInputProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}

export function TextInput({ label, value, onChange }: Readonly<TextInputProps>): ReactNode {
  return (
    <TextField className={styles.field} value={value} onChange={onChange}>
      <Label className={styles.label}>{label}</Label>
      <Input className={styles.input} />
    </TextField>
  );
}
