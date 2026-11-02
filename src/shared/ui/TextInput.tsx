import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { FieldError, Input, Label, TextField } from "react-aria-components";

import styles from "./TextInput.module.css";

interface TextInputProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Takes focus when it appears, for a field that opens on its own (an in-place rename). */
  readonly focusOnMount?: boolean;
  /** Shown under the field, which is then marked invalid. */
  readonly errorMessage?: string | undefined;
  /** Escape in the field: cancel whatever it edits. */
  readonly onEscape?: () => void;
}

export function TextInput({
  label,
  value,
  onChange,
  focusOnMount = false,
  errorMessage,
  onEscape,
}: Readonly<TextInputProps>): ReactNode {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusOnMount) {
      inputRef.current?.focus();
    }
  }, [focusOnMount]);
  return (
    <TextField
      className={styles.field}
      value={value}
      onChange={onChange}
      isInvalid={errorMessage !== undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape" && onEscape !== undefined) {
          onEscape();
          return;
        }
        event.continuePropagation();
      }}
    >
      <Label className={styles.label}>{label}</Label>
      <Input ref={inputRef} className={styles.input} />
      <FieldError className={styles.error}>{errorMessage}</FieldError>
    </TextField>
  );
}
