import type { ReactNode } from "react";

import { ThemePicker } from "~/features/theming";
import type { ThemeId } from "~/features/theming";
import { m } from "~/i18n/paraglide/messages";
import { LanguagePicker } from "~/shared/ui";

const themeLabels = (): Readonly<Record<ThemeId, string>> => ({
  light: m.theme_light(),
  dark: m.theme_dark(),
  "high-contrast": m.theme_high_contrast(),
});

/** Theme and language, labelled for screen readers only: the chip header has room for them. */
export function EditorPreferences(): ReactNode {
  return (
    <>
      <ThemePicker label={m.theme_label()} optionLabels={themeLabels()} isLabelHidden />
      <LanguagePicker isLabelHidden />
    </>
  );
}
