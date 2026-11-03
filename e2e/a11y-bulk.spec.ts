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
    await expect(canvasHost(page)).toBeVisible();
  });
}
