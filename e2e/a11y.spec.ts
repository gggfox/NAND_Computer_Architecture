import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { createProject, expect, pickTheme, test, THEMES } from "./support";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

const violations = async (page: Page) => {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations;
};

for (const theme of THEMES) {
  test(`index and project pages have no WCAG violations in the ${theme} theme`, async ({
    page,
  }) => {
    await createProject(page);
    await pickTheme(page, theme);
    expect(await violations(page)).toEqual([]);

    // The index has no theme picker; the choice persists and applies before first paint.
    await page.getByRole("link", { name: "All projects" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
}
