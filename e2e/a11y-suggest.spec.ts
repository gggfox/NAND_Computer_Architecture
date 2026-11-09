import path from "node:path";

import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { canvasHost, createProject, expect, pickTheme, spoken, test, THEMES } from "./support";
import { pressEditorTool } from "./toolbar-support";

/* Axe on Suggest wires (phase 5c), in every theme: the bar showing and a ghost focused. */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const REGISTER_FILE = path.join(import.meta.dirname, "fixtures", "register-file.json");

const violations = async (page: Page) => {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations;
};

test.beforeEach(({ isMobile }) => {
  test.skip(isMobile, "Keyboard flow; the touch spec covers the bar");
});

for (const theme of THEMES) {
  test(`the suggestions bar and a focused ghost have no WCAG violations in the ${theme} theme`, async ({
    page,
  }) => {
    await createProject(page);
    const chooserEvent = page.waitForEvent("filechooser");
    await pressEditorTool(page, "Import");
    const chooser = await chooserEvent;
    await chooser.setFiles(REGISTER_FILE);
    await expect(page.getByRole("heading", { level: 1, name: "Register file" })).toBeAttached();
    await pickTheme(page, theme);

    await canvasHost(page).focus();
    await page.keyboard.press("Shift+W");
    await expect(spoken(page)).toHaveText(/Wires suggested: 20/u);
    await expect(
      page.getByRole("toolbar", { name: "Suggested wires" }).getByText("Suggested wires: 20"),
    ).toBeVisible();
    expect(await violations(page)).toEqual([]);

    await page.keyboard.press("n");
    expect(await violations(page)).toEqual([]);
  });
}
