import { themeIds } from "../domain/themes";
import { THEME_STORAGE_KEY } from "./apply-theme";

/**
 * Runs as an inline script in the pre-rendered shell's <head>, before first paint, so the stored or
 * OS-preferred theme applies without a flash. It mirrors `resolveInitialTheme` and must stay
 * self-contained: it is serialized with `toString()`, so it can use no imports or outer variables.
 */
function bootTheme(key: string, ids: readonly string[]): void {
  let stored: string | undefined = undefined;
  try {
    stored = localStorage.getItem(key) ?? undefined;
  } catch {
    // Storage blocked: fall through to OS preferences.
  }
  let theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  if (matchMedia("(prefers-contrast: more)").matches) {
    theme = "high-contrast";
  }
  if (stored !== undefined && ids.includes(stored)) {
    theme = stored;
  }
  document.documentElement.dataset["theme"] = theme;
}

export const themeBootScript = `(${bootTheme.toString()})(${JSON.stringify(THEME_STORAGE_KEY)}, ${JSON.stringify(themeIds)})`;
