import { m } from "~/i18n/paraglide/messages";

import type { ThemeId } from "../domain/themes";

/** The translated name of each theme, for a theme picker. */
export const themeOptionLabels = (): Readonly<Record<ThemeId, string>> => ({
  amber: m.theme_amber(),
  light: m.theme_light(),
  dark: m.theme_dark(),
  "high-contrast": m.theme_high_contrast(),
});
