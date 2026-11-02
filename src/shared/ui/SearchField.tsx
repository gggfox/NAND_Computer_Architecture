import type { ReactNode } from "react";
import { Button, Input, Label, SearchField as AriaSearchField } from "react-aria-components";

import styles from "./SearchField.module.css";

/** The clear button's glyph; React Aria names the button itself. */
const CLEAR = "×";

interface SearchFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Takes focus as it mounts, as a popover's search does. */
  readonly autoFocus?: boolean;
}

/** A search box: Escape or its clear button (named by React Aria, in the app's locale) empties it. */
export function SearchField({
  label,
  value,
  onChange,
  autoFocus = false,
}: Readonly<SearchFieldProps>): ReactNode {
  return (
    <AriaSearchField
      className={styles.field}
      value={value}
      onChange={onChange}
      // oxlint-disable-next-line jsx-a11y/no-autofocus -- only a just-opened popover asks for it
      autoFocus={autoFocus}
    >
      <Label className={styles.label}>{label}</Label>
      <div className={styles.box}>
        <Input className={styles.input} />
        <Button className={styles.clear}>{CLEAR}</Button>
      </div>
    </AriaSearchField>
  );
}
