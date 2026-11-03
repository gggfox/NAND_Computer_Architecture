import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import {
  canvasHost,
  chipCenter,
  createProject,
  DEMO_PART,
  expect,
  pickTheme,
  test,
  THEMES,
} from "./support";

/* Axe on the selection bar and the Array dialog (phase 5a), in every theme. */

/** The same WCAG 2.2 AA tags as `a11y.spec.ts`. */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

const violations = async (page: Page) => {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations;
};

for (const theme of THEMES) {
  test(`the selection bar and the Array dialog have no WCAG violations in the ${theme} theme`, async ({
    page,
  }) => {
    await createProject(page);
    await pickTheme(page, theme);
    const nand = await chipCenter(page, DEMO_PART.nand);
    await page.mouse.click(nand.x, nand.y);
    const bar = page.getByRole("toolbar", { name: "Selection actions" });
    await expect(bar).toBeVisible();
    expect(await violations(page)).toEqual([]);

    await bar.getByRole("button", { name: "Array…" }).click();
    const dialog = page.getByRole("dialog", { name: "Array" });
    await expect(dialog).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(canvasHost(page)).toBeFocused();
  });
}

/** Selects the demo's NAND and returns the selection bar. */
const selectNand = async (page: Page) => {
  await createProject(page);
  const nand = await chipCenter(page, DEMO_PART.nand);
  await page.mouse.click(nand.x, nand.y);
  return page.getByRole("toolbar", { name: "Selection actions" });
};

test("Escape in an Array dialog opened from the chip menu gives focus back to the canvas", async ({
  page,
}) => {
  await selectNand(page);
  const nand = await chipCenter(page, DEMO_PART.nand);
  await page.mouse.click(nand.x, nand.y, { button: "right" });
  await page.getByRole("menuitem", { name: "Array…" }).click();
  await expect(page.getByRole("dialog", { name: "Array" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Array" })).toHaveCount(0);
  await expect(canvasHost(page)).toBeFocused();
});

test("Delete in the selection bar, from the keyboard, leaves focus on the canvas", async ({
  page,
}) => {
  const bar = await selectNand(page);
  const remove = bar.getByRole("button", { name: "Delete" });
  await remove.focus();
  await page.keyboard.press("Enter");
  await expect(bar).toHaveCount(0);
  await expect(canvasHost(page)).toBeFocused();
});
