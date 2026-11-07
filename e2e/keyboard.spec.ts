import type { Locator, Page } from "@playwright/test";

import { expect, output, PROJECT_URL, test } from "./support";

const MAX_TABS = 30;

/** The accessible text of the focused control: a button's label or a switch's `<label>`. */
const focusedName = (page: Page) =>
  page.evaluate(() => {
    const focused = document.activeElement;
    return (focused?.closest("label") ?? focused)?.textContent.trim() ?? "";
  });

type Control = "button" | "switch";

/**
 * The element that draws the focus ring. A button draws its own ring. A switch's `<input>` is
 * visually hidden, so the ring is drawn on the track: the `<span>` that holds the thumb `<span>`
 * inside the switch's `<label>`. Only that track counts, so a ring on any other element fails.
 */
const ringTarget = (page: Page, control: Control, name: string): Locator =>
  control === "button"
    ? page.getByRole("button", { name, exact: true })
    : page.locator("label").filter({ hasText: name }).locator("span:has(> span)");

const outlineStyle = (target: Locator): Promise<string> =>
  target.evaluate((element) => getComputedStyle(element).outlineStyle);

const tabTo = async (page: Page, control: Control, name: string): Promise<void> => {
  const target = ringTarget(page, control, name);
  const unfocusedOutline = await outlineStyle(target);
  for (let step = 0; step < MAX_TABS; step += 1) {
    await page.keyboard.press("Tab");
    if ((await focusedName(page)) === name) {
      expect(unfocusedOutline).toBe("none");
      expect(await outlineStyle(target)).not.toBe(unfocusedOutline);
      return;
    }
  }
  throw new Error(`"${name}" was not reached within ${String(MAX_TABS)} Tab presses`);
};

test("create a project and drive the NAND with the keyboard alone", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "New project" })).toBeVisible();

  await tabTo(page, "button", "New project");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(PROJECT_URL);
  await expect(output(page)).toHaveText("Output OUT: 1");

  await tabTo(page, "switch", "Input A");
  await page.keyboard.press("Space");
  await expect(output(page)).toHaveText("Output OUT: 1");

  await tabTo(page, "switch", "Input B");
  await page.keyboard.press("Space");
  await expect(output(page)).toHaveText("Output OUT: 0");
});
