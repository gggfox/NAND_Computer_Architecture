import { useState } from "react";
import type { ReactNode } from "react";

import { Select } from "~/shared/ui";

import { applyTheme, initTheme, storeTheme } from "../adapters/apply-theme";
import { isThemeId, themeIds } from "../domain/themes";
import type { ThemeId } from "../domain/themes";

import styles from "./ThemePicker.module.css";

interface ThemePickerProps {
  readonly label: string;
  readonly optionLabels: Readonly<Record<ThemeId, string>>;
  readonly isLabelHidden?: boolean;
}

export function ThemePicker({
  label,
  optionLabels,
  isLabelHidden = false,
}: Readonly<ThemePickerProps>): ReactNode {
  const [theme, setTheme] = useState<ThemeId>(initTheme);
  const options = themeIds.map((id) => ({ id, label: optionLabels[id] }));

  const onChange = (key: string): void => {
    if (isThemeId(key)) {
      setTheme(key);
      applyTheme(document.documentElement, key);
      storeTheme(key);
    }
  };

  return (
    <div className={styles.root}>
      <Select
        label={label}
        isLabelHidden={isLabelHidden}
        options={options}
        value={theme}
        onChange={onChange}
      />
    </div>
  );
}
