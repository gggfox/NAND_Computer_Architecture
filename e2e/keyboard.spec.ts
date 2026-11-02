import type { Page } from "@playwright/test";

import { expect, output, PROJECT_URL, test } from "./support";

const MAX_TABS = 30;

/** The accessible text of the focused control: a button's label or a switch's `<label>`. */
const focusedName = (page: Page) =>
  page.evaluate(() => {
    const focused = document.activeElement;
    return (focused?.closest("label") ?? focused)?.textContent.trim() ?? "";
  });

/**
 * The computed outline of the focused control's visible ring. A switch's `<input>` is visually
 * hidden, so its ring is drawn on the track inside the same `<label>`.
 */
const focusRingStyle = (page: Page) =>
  page.evaluate(() => {
    const focused = document.activeElement;
    if (!(focused instanceof HTMLElement)) {
      return "none";
    }
    const label = focused.closest("label");
    const candidates =
      label === null
        ? [focused]
        : [...label.querySelectorAll("*")].filter((node) => !node.contains(focused));
    const ring = candidates.find((node) => getComputedStyle(node).outlineStyle !== "none");
    return ring === undefined ? "none" : getComputedStyle(ring).outlineStyle;
  });

const tabTo = async (page: Page, name: string): Promise<void> => {
  for (let step = 0; step < MAX_TABS; step += 1) {
    await page.keyboard.press("Tab");
    if ((await focusedName(page)) === name) {
      expect(await focusRingStyle(page)).not.toBe("none");
      return;
    }
  }
  throw new Error(`"${name}" was not reached within ${String(MAX_TABS)} Tab presses`);
};

test("create a project and drive the NAND with the keyboard alone", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "New project" })).toBeVisible();

  await tabTo(page, "New project");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(PROJECT_URL);
  await expect(output(page)).toHaveText("Output OUT: 1");

  await tabTo(page, "Input A");
  await page.keyboard.press("Space");
  await expect(output(page)).toHaveText("Output OUT: 1");

  await tabTo(page, "Input B");
  await page.keyboard.press("Space");
  await expect(output(page)).toHaveText("Output OUT: 0");
});
