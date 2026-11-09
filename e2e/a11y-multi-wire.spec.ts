/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import path from "node:path";

import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { createProject, expect, pickTheme, spoken, test, THEMES, worldToPage } from "./support";
import type { Point } from "./support";
import { pressEditorTool } from "./toolbar-support";

/* Axe on pin picking (phase 5b), in every theme: the bar with Pick pins, the card's button, a refusal. */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const RAM_CELL = path.join(import.meta.dirname, "fixtures", "ram-cell.json");
const COPIES = "3";
const SOURCE: Point = { x: 40, y: 20 };
const CELL_MIDDLE: Point = { x: 220, y: 40 };
const CELL_CLK: Point = { x: 160, y: 60 };

const violations = async (page: Page) => {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations;
};

const click = async (page: Page, world: Point, button: "left" | "right" = "left") => {
  const point = await worldToPage(page, world);
  await page.mouse.click(point.x, point.y, { button });
};

/** Imports the RAM cell project, wires its first `clk` by hand and makes an Array of Cells. */
const setUp = async (page: Page, theme: (typeof THEMES)[number]): Promise<void> => {
  await createProject(page);
  const chooserEvent = page.waitForEvent("filechooser");
  await pressEditorTool(page, "Import");
  const chooser = await chooserEvent;
  await chooser.setFiles(RAM_CELL);
  await expect(page.getByRole("heading", { level: 1, name: "RAM cell" })).toBeAttached();
  await pickTheme(page, theme);
  await click(page, SOURCE);
  await click(page, CELL_CLK);
  await expect(spoken(page)).toHaveText(/Wire added/u);
  await click(page, CELL_MIDDLE);
  const bar = page.getByRole("toolbar", { name: "Selection actions" });
  await bar.getByRole("button", { name: "Array…" }).click();
  const dialog = page.getByRole("dialog", { name: "Array" });
  const field = dialog.getByRole("textbox", { name: "Copies" });
  await field.fill(COPIES);
  await field.blur();
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(dialog).toHaveCount(0);
};

test.beforeEach(({ isMobile }) => {
  test.skip(isMobile, "Mouse flows; the touch spec covers Pick pins");
});

for (const theme of THEMES) {
  test(`picked pins, the card's button and a refusal have no WCAG violations in the ${theme} theme`, async ({
    page,
  }) => {
    await setUp(page, theme);
    await click(page, CELL_CLK, "right");
    const button = page.getByRole("button", { name: "Select this pin on all selected chips" });
    await expect(button).toBeVisible();
    expect(await violations(page)).toEqual([]);

    await button.click();
    await expect(spoken(page)).toHaveText(/Pins selected: 4/u);
    const bar = page.getByRole("toolbar", { name: "Selection actions" });
    await expect(bar.getByRole("button", { name: "Pick pins" })).toBeVisible();
    expect(await violations(page)).toEqual([]);

    await click(page, SOURCE);
    await expect(spoken(page)).toHaveText(/clk on Cell/u);
    await expect(
      page.locator("p[aria-hidden=true]").filter({ hasText: /clk on Cell/u }),
    ).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
}
