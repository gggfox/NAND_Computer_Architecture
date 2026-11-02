import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { FieldError, Input, Label, Text, TextField } from "react-aria-components";

import styles from "./TextInput.module.css";

interface TextInputProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Takes focus when it appears, for a field that opens on its own (an in-place rename). */
  readonly focusOnMount?: boolean;
  /** A hint under the field, read out with it. */
  readonly description?: string | undefined;
  /** Shown under the field, which is then marked invalid. */
  readonly errorMessage?: string | undefined;
  /** Escape in the field: cancel whatever it edits. */
  readonly onEscape?: (() => void) | undefined;
  /** Enter in the field, for a field outside a form (a list row's name). */
  readonly onEnter?: (() => void) | undefined;
  readonly onBlur?: () => void;
  /** Receives the input element, so a list can move focus between its fields. */
  readonly inputRef?: (element: HTMLInputElement | null) => void;
  /** The label is still read out but not shown, where the field's place says what it is. */
  readonly isLabelHidden?: boolean;
}

/** The handler for a key the field acts on itself, if `key` is one. */
const handlerFor = (
  key: string,
  { onEscape, onEnter }: Pick<TextInputProps, "onEscape" | "onEnter">,
): (() => void) | undefined => {
  if (key === "Escape") {
    return onEscape;
  }
  return key === "Enter" ? onEnter : undefined;
};

/** The hint and the error under the field. */
function FieldNotes({
  description,
  errorMessage,
}: Pick<TextInputProps, "description" | "errorMessage">): ReactNode {
  return (
    <>
      {description === undefined ? undefined : (
        <Text slot="description" className={styles.description}>
          {description}
        </Text>
      )}
      <FieldError className={styles.error}>{errorMessage}</FieldError>
    </>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  focusOnMount = false,
  description,
  errorMessage,
  onEscape,
  onEnter,
  onBlur,
  inputRef,
  isLabelHidden = false,
}: Readonly<TextInputProps>): ReactNode {
  const ownRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusOnMount) {
      ownRef.current?.focus();
    }
  }, [focusOnMount]);
  return (
    <TextField
      className={styles.field}
      value={value}
      onChange={onChange}
      isInvalid={errorMessage !== undefined}
      {...(onBlur === undefined ? {} : { onBlur })}
      onKeyDown={(event) => {
        const handler = handlerFor(event.key, { onEscape, onEnter });
        if (handler === undefined) {
          event.continuePropagation();
          return;
        }
        handler();
      }}
    >
      <Label className={isLabelHidden ? "visually-hidden" : styles.label}>{label}</Label>
      <Input
        ref={(element) => {
          ownRef.current = element;
          inputRef?.(element);
        }}
        className={styles.input}
      />
      <FieldNotes description={description} errorMessage={errorMessage} />
    </TextField>
  );
}
