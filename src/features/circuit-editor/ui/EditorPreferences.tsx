import type { ReactNode } from "react";

import { ThemePicker, themeOptionLabels } from "~/features/theming";
import { m } from "~/i18n/paraglide/messages";
import { LanguagePicker } from "~/shared/ui";

/** Theme and language, labelled for screen readers only: the chip header has room for them. */
export function EditorPreferences(): ReactNode {
  return (
    <>
      <ThemePicker label={m.theme_label()} optionLabels={themeOptionLabels()} isLabelHidden />
      <LanguagePicker isLabelHidden />
    </>
  );
}
