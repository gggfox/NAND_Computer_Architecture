/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import path from "node:path";

import type { Locator, Page } from "@playwright/test";

import { importLibrary, libraryRow, openLibrary } from "./library-support";
import {
  chipPath,
  importSaveFlow,
  moveNand,
  openChip,
  selectOnCanvas,
  unsavedDot,
} from "./save-support";
import {
  createProject,
  expect,
  output,
  pickTheme,
  setInputs,
  test,
  THEMES,
  worldToPage,
} from "./support";
import { pressEditorTool } from "./toolbar-support";

const slug = (theme: string): string => theme.toLowerCase().replaceAll(" ", "-");

/*
 * Canvas baselines are Linux-only: generate them with `pnpm e2e:visual:docker --update-snapshots`
 * (or in CI). `pnpm e2e` excludes @visual, so a missing baseline never fails it.
 */
for (const theme of THEMES) {
  test(
    `demo canvas with A = 1 and B = 1 in the ${theme} theme`,
    { tag: "@visual" },
    async ({ page }) => {
      await createProject(page);
      await pickTheme(page, theme);
      await setInputs(page, true, true);
      await expect(output(page)).toHaveText("Output OUT: 0");
      // The main canvas; its screenshot includes the minimap drawn over its corner.
      await expect(page.locator("canvas").first()).toHaveScreenshot(`demo-${slug(theme)}.png`);
    },
  );
}

const DEMO_INPUTS = 2;

test("demo with the Pins panel open", { tag: "@visual" }, async ({ page }) => {
  await createProject(page);
  await expect(page.getByRole("grid", { name: "Inputs" }).getByRole("row")).toHaveCount(
    DEMO_INPUTS,
  );
  // The whole editor: the canvas, its pin badges and the panel beside it.
  await expect(page).toHaveScreenshot("demo-pins-panel.png");
});

/** Tall enough that the header row leaves Main's "Draft only" badge and reason in view. */
const TALL_VIEWPORT = { width: 1280, height: 900 };

test("the library open with Arithmetic expanded", { tag: "@visual" }, async ({ page }) => {
  await page.setViewportSize(TALL_VIEWPORT);
  await importLibrary(page);
  const tree = await openLibrary(page);
  await libraryRow(tree, "Arithmetic").click();
  await expect(libraryRow(tree, "Adders")).toBeVisible();
  // The pointer would leave a hover style on the row it clicked.
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot("library-panel.png");
});

/** Empty canvas where the quick-add opens, in world units. */
const QUICK_ADD_AT = { x: 400, y: 240 };

test("the quick-add menu", { tag: "@visual" }, async ({ page }) => {
  await importLibrary(page);
  const at = await worldToPage(page, QUICK_ADD_AT);
  await page.mouse.click(at.x, at.y, { button: "right" });
  const menu = page.getByRole("dialog", { name: "Add to canvas" });
  await expect(menu.getByRole("searchbox", { name: "Search chips" })).toBeFocused();
  await expect(page).toHaveScreenshot("quick-add.png");
});

test(
  "the chip header inside Full adder › Half adder, with unsaved changes",
  { tag: "@visual" },
  async ({ page }) => {
    await importSaveFlow(page);
    await openChip(page, "Full adder");
    await selectOnCanvas(page, /Half adder 1 selected/u);
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "Look inside" }).click();
    await expect(chipPath(page).getByRole("listitem")).toHaveText(["Full adder", "Half adder"]);
    await moveNand(page);
    await expect(unsavedDot(page)).toBeAttached();
    // The header row alone (the breadcrumbs' parent): breadcrumbs, the dot, Save and ⋯.
    await expect(chipPath(page).locator("..")).toHaveScreenshot("chip-header.png");
  },
);

const HALF_ADDER = path.join(import.meta.dirname, "fixtures", "half-adder.json");
const HALF_ADDER_PARTS = 10;
const HALF_ADDER_WIRES = 14;
/** The side panel scrolls. This height lets the whole structure view of a half adder fit in it. */
const STRUCTURE_VIEWPORT = { width: 1280, height: 2600 };

const structureRegion = (page: Page): Locator =>
  page.getByRole("region", { name: "Circuit structure" });

test(
  "the structure view of a half adder, with the pins of NAND gate 1 open",
  { tag: "@visual" },
  async ({ page }) => {
    await page.setViewportSize(STRUCTURE_VIEWPORT);
    await createProject(page);
    const chooserEvent = page.waitForEvent("filechooser");
    await pressEditorTool(page, "Import");
    const chooser = await chooserEvent;
    await chooser.setFiles(HALF_ADDER);
    await expect(page.getByRole("heading", { level: 1, name: "Half adder" })).toBeAttached();
    const region = structureRegion(page);
    await expect(region.getByRole("list").first().locator("> li")).toHaveCount(HALF_ADDER_PARTS);
    await expect(region.getByRole("list").last().locator("> li")).toHaveCount(HALF_ADDER_WIRES);
    const toggle = region.getByRole("button", { name: "Pins of NAND gate 1" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    // The pointer would leave a hover style on the toggle it clicked.
    await page.mouse.move(0, 0);
    await expect(region).toHaveScreenshot("structure-half-adder.png");
  },
);

test("the Wire to… dialog from Input A", { tag: "@visual" }, async ({ page }) => {
  await createProject(page);
  await page.getByRole("button", { name: "Add NAND" }).click();
  const region = structureRegion(page);
  await expect(region.getByText("NAND gate 2")).toBeVisible();
  await region.getByRole("button", { name: "Pins of Input A" }).click();
  await region.getByRole("button", { name: "Actions for A of Input A" }).click();
  await page.getByRole("menuitem", { name: "Wire to…" }).click();
  const dialog = page.getByRole("dialog", { name: "Wire A of Input A to…" });
  await expect(dialog.getByRole("searchbox", { name: "Search pins" })).toBeFocused();
  await page.mouse.move(0, 0);
  await expect(dialog).toHaveScreenshot("wire-to-dialog.png");
});
