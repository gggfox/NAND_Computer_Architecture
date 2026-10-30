import { expect, test as base } from "@playwright/test";
import type { Page } from "@playwright/test";

/** Every spec runs with reduced motion on, so no assertion races a transition (ADR 10). */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await use(page);
  },
});

export { expect } from "@playwright/test";

/** The editor adds its view (`?zoom=…&x=…&y=…`) to the URL. */
export const PROJECT_URL = /\/projects\/[0-9a-f-]{36}(?:\?|$)/u;

export type Theme = "Light" | "Dark" | "High contrast";
export const THEMES: readonly Theme[] = ["Light", "Dark", "High contrast"];

/** Opens the index and creates the demo project (two inputs into one NAND), landing on its page. */
export const createProject = async (page: Page): Promise<void> => {
  await page.goto("/");
  await page.getByRole("button", { name: "New project" }).click();
  await expect(page).toHaveURL(PROJECT_URL);
  await expect(output(page)).toHaveText(/Output: [01]/u);
};

type SwitchName = "Input A" | "Input B";

export const inputSwitch = (page: Page, name: SwitchName) => page.getByRole("switch", { name });

/** The summary's live region (the status `<output>` above the canvas is a different element). */
export const output = (page: Page) => page.getByText(/^Output: /u);

/** Picks a theme through the toolbar's Theme select (the user path, not localStorage). */
export const pickTheme = async (page: Page, theme: Theme): Promise<void> => {
  await page.getByRole("button", { name: /Theme$/u }).click();
  await page.getByRole("option", { name: theme, exact: true }).click();
  await expect(page.getByRole("listbox")).toBeHidden();
};

/**
 * Sets a switch the way a pointer user does: by pressing its visible label. The `<input
 * role="switch">` itself is visually hidden under the track, so it cannot be clicked directly.
 */
export const setSwitch = async (page: Page, name: SwitchName, on: boolean): Promise<void> => {
  const control = inputSwitch(page, name);
  if ((await control.isChecked()) !== on) {
    await page.locator("label").filter({ has: control }).click();
  }
  await expect(control).toBeChecked({ checked: on });
};

export const setInputs = async (page: Page, a: boolean, b: boolean): Promise<void> => {
  await setSwitch(page, "Input A", a);
  await setSwitch(page, "Input B", b);
};
