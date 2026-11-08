import { resolveInitialTheme } from "../domain/themes";
import type { ThemeId } from "../domain/themes";

export const THEME_STORAGE_KEY = "nand.theme";

// A DOM element cannot be a readonly type; mutating it is this function's purpose.
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
export const applyTheme = (root: HTMLElement, id: ThemeId): void => {
  root.dataset["theme"] = id;
};

const readStoredTheme = (): string | null | undefined => {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return undefined;
  }
};

export const storeTheme = (id: ThemeId): void => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // Storage can be blocked (private mode, quota); the theme still applies for this session.
  }
};

/** Resolves the stored choice or the OS contrast preference, applies it to the document and returns it. */
export const initTheme = (): ThemeId => {
  const id = resolveInitialTheme(readStoredTheme(), matchMedia("(prefers-contrast: more)").matches);
  applyTheme(document.documentElement, id);
  return id;
};
