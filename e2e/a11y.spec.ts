import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { canvasHost, createProject, expect, pickTheme, spoken, test, THEMES } from "./support";

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

const STEPS_TO_NAND = 3;

for (const theme of THEMES) {
  test(`the canvas's selection, menu, pin card and help have no WCAG violations in the ${theme} theme`, async ({
    page,
  }) => {
    await createProject(page);
    await pickTheme(page, theme);
    const host = canvasHost(page);
    await host.focus();
    for (let step = 0; step < STEPS_TO_NAND; step += 1) {
      await page.keyboard.press("]");
    }
    await expect(spoken(page)).toHaveText(/NAND gate 1 selected/u);
    expect(await violations(page)).toEqual([]);

    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu", { name: "Chip actions" })).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(host).toBeFocused();

    await page.keyboard.press("p");
    await expect(page.getByText("1 bit")).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await page.keyboard.press("Escape");

    await page.keyboard.press("?");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
}
