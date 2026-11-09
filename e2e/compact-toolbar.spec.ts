import { AxeBuilder } from "@axe-core/playwright";
import type { Locator, Page, TestInfo } from "@playwright/test";

import { createProject, expect, test, urlCamera } from "./support";
import { editorToolbar } from "./toolbar-support";

/*
 * On a phone the editor toolbar takes two rows at most: the frequent tools stay, the others go to
 * a More tools menu, and the zoom controls move to a magnifying glass in the canvas corner.
 */

const PHONES = new Set(["mobile-chrome", "mobile-safari"]);
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
/** Two rows of 44 px controls, their gap and the toolbar's padding and border. */
const TWO_ROWS_MAX = 120;
const MORE_TOOLS = [
  "Colour for new wires",
  "Tidy wires",
  "Suggest wires",
  "Keyboard shortcuts",
  "Export",
  "Import",
];

const violations = async (page: Page) => {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations;
};

const heightOf = async (toolbar: Locator): Promise<number> => {
  const box = await toolbar.boundingBox();
  return box?.height ?? Number.POSITIVE_INFINITY;
};

const phonesOnly = (testInfo: TestInfo): void => {
  test.skip(!PHONES.has(testInfo.project.name), "The compact toolbar is for phones");
};

const moreButton = (page: Page) => editorToolbar(page).getByRole("button", { name: "More tools" });
const zoomButton = (page: Page) => page.getByRole("button", { name: "Zoom", exact: true });

test("the toolbar takes two rows and keeps the frequent tools", async ({ page }, testInfo) => {
  phonesOnly(testInfo);
  await createProject(page);
  const toolbar = editorToolbar(page);
  for (const name of ["Library", "Undo", "Redo", "Add NAND", "Delete", "More tools"]) {
    await expect(toolbar.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await expect(toolbar.getByRole("radio", { name: "Pan" })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "Export" })).toBeHidden();
  await expect(toolbar.getByRole("button", { name: "Fit" })).toBeHidden();
  expect(await heightOf(editorToolbar(page))).toBeLessThanOrEqual(TWO_ROWS_MAX);
  expect(await violations(page)).toEqual([]);
});

test("in Spanish too, the toolbar takes two rows", async ({ page }, testInfo) => {
  phonesOnly(testInfo);
  await createProject(page);
  await page.getByRole("button", { name: /Language$/u }).click();
  await page.getByRole("option", { name: "Español" }).click();
  const toolbar = page.getByRole("toolbar", { name: "Herramientas del editor" });
  await expect(toolbar.getByRole("button", { name: "Más herramientas" })).toBeVisible();
  expect(await heightOf(toolbar)).toBeLessThanOrEqual(TWO_ROWS_MAX);
});

test("the More tools menu holds every other tool and opens the keyboard help", async ({
  page,
}, testInfo) => {
  phonesOnly(testInfo);
  await createProject(page);
  await moreButton(page).click();
  const menu = page.getByRole("menu", { name: "More tools" });
  await expect(menu.getByRole("menuitem")).toHaveText(MORE_TOOLS);
  expect(await violations(page)).toEqual([]);
  await menu.getByRole("menuitem", { name: "Keyboard shortcuts" }).click();
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
});

test("the magnifying glass opens the zoom controls, which zoom and fit", async ({
  page,
}, testInfo) => {
  phonesOnly(testInfo);
  await createProject(page);
  const before = urlCamera(page).zoom;
  await zoomButton(page).click();
  const controls = page.getByRole("dialog", { name: "Zoom" });
  await expect(controls.getByRole("button")).toHaveText(["Zoom out", "Zoom in", "Fit"]);
  expect(await violations(page)).toEqual([]);
  await controls.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(() => urlCamera(page).zoom).toBeGreaterThan(before);
  // The controls stay open for the next press.
  await controls.getByRole("button", { name: "Zoom out" }).click();
  await expect.poll(() => urlCamera(page).zoom).toBe(before);
  await page.keyboard.press("Escape");
  await expect(controls).toHaveCount(0);
  await expect(zoomButton(page)).toBeFocused();
});
test("a wide screen keeps every tool in the toolbar and no zoom corner", async ({
  page,
}, testInfo) => {
  test.skip(PHONES.has(testInfo.project.name), "Wide screens only");
  await createProject(page);
  const toolbar = editorToolbar(page);
  for (const name of ["Tidy wires", "Suggest wires", "Zoom in", "Fit", "Export", "Import"]) {
    await expect(toolbar.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await expect(moreButton(page)).toBeHidden();
  await expect(zoomButton(page)).toBeHidden();
});
