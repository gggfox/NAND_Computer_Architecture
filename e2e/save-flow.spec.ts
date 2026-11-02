import type { Locator, Page } from "@playwright/test";

import { libraryRow, libraryToggle, libraryTree, openLibrary } from "./library-support";
import { closePins, openPins } from "./pins-support";
import {
  chipPath,
  draftWireCount,
  importSaveFlow,
  moreButton,
  moveNand,
  openChip,
  outcome,
  saveButton,
  selectOnCanvas,
  unsavedDot,
} from "./save-support";
import { canvasHost, createProject, expect, test } from "./support";

/** Full adder's wires in the fixture: X and Y into the Half adder's A and B. */
const FULL_ADDER_WIRES = 2;

test("a save that drops no wire saves at once", async ({ page }) => {
  await importSaveFlow(page);
  await expect(saveButton(page)).toBeDisabled();
  await expect(unsavedDot(page)).toHaveCount(0);

  await moveNand(page);
  await expect(unsavedDot(page)).toBeAttached();
  await saveButton(page).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(unsavedDot(page)).toHaveCount(0);
  await expect(outcome(page, "Saved Half adder")).toBeAttached();
  await expect(saveButton(page)).toBeDisabled();

  // Spoken once: coming back to the chip does not announce the old save again.
  await openChip(page, "Full adder");
  await expect(outcome(page, "Saved Half adder")).toHaveCount(0);
  await openChip(page, "Half adder");
  await expect(outcome(page, "Saved Half adder")).toHaveCount(0);
});

test("a save that drops a parent's wire asks first, and Cancel keeps the parent", async ({
  page,
}) => {
  await importSaveFlow(page);
  const pins = await openPins(page);
  await pins.getByRole("button", { name: "Actions for B" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await closePins(page);

  await saveButton(page).click();
  const dialog = page.getByRole("dialog", { name: "Save Half adder?" });
  await expect(dialog).toContainText("Saving updates every chip that uses it:");
  await expect(dialog.getByRole("listitem")).toHaveText([
    "Pin B removed",
    "Wires removed in Full adder: 1",
  ]);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(unsavedDot(page)).toBeAttached();
  // Review Focus 3: nothing was saved, so Full adder keeps both wires.
  await openChip(page, "Full adder");
  expect(await draftWireCount(page, "Full adder")).toBe(FULL_ADDER_WIRES);

  await openChip(page, "Half adder");
  await expect(unsavedDot(page)).toBeAttached();
  await saveButton(page).click();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(outcome(page, "Saved Half adder")).toBeAttached();
  await openChip(page, "Full adder");
  expect(await draftWireCount(page, "Full adder")).toBe(FULL_ADDER_WIRES - 1);
});

test("Discard restores the saved version, and Undo brings the edit back", async ({ page }) => {
  await importSaveFlow(page);
  await expect(moreButton(page)).toHaveCount(0);
  await moveNand(page);

  await moreButton(page).click();
  await page.getByRole("menuitem", { name: "Discard changes…" }).click();
  const dialog = page.getByRole("dialog", { name: "Discard changes to Half adder?" });
  await expect(dialog).toContainText("The chip goes back to its last saved version.");
  await dialog.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(unsavedDot(page)).toHaveCount(0);
  await expect(outcome(page, "Changes to Half adder discarded")).toBeAttached();
  await expect(saveButton(page)).toBeDisabled();

  // D3: a discard is an undo step.
  await canvasHost(page).focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(unsavedDot(page)).toBeAttached();
  await expect(saveButton(page)).toBeEnabled();
  await expect(outcome(page, "Changes to Half adder discarded")).toHaveCount(0);
  // Redo restores the discarded state, but the discard is not announced again.
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(unsavedDot(page)).toHaveCount(0);
  await expect(outcome(page, "Changes to Half adder discarded")).toHaveCount(0);
});

test("a never-saved chip has Save and no Discard", async ({ page }) => {
  await importSaveFlow(page);
  await openChip(page, "Scratch");
  await expect(unsavedDot(page)).toBeAttached();
  await expect(saveButton(page)).toBeEnabled();
  await expect(moreButton(page)).toHaveCount(0);
});

test("Look inside adds a breadcrumb, and going back saves nothing", async ({ page }) => {
  await importSaveFlow(page);
  await openChip(page, "Full adder");
  await selectOnCanvas(page, /Half adder 1 selected/u);
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Look inside" }).click();
  await expect(chipPath(page).getByRole("listitem")).toHaveText(["Full adder", "Half adder"]);
  await expect(chipPath(page).getByText("Half adder", { exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await moveNand(page);
  await chipPath(page).getByRole("button", { name: "Full adder" }).click();
  await expect(chipPath(page).getByRole("listitem")).toHaveText(["Full adder"]);
  // Going back saved nothing: Half adder still has its unsaved move.
  await openChip(page, "Half adder");
  await expect(unsavedDot(page)).toBeAttached();
});

/** The narrowest phone the layout supports. */
const NARROW = { width: 320, height: 640 };
const LONG_NAME = "Half adder with a very long name that cannot fit";

test("on a 320 px phone, long breadcrumbs truncate and the page never scrolls sideways", async ({
  page,
}) => {
  await page.setViewportSize(NARROW);
  await importSaveFlow(page);
  await openChip(page, "Full adder");
  await selectOnCanvas(page, /Half adder 1 selected/u);
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Rename chip…" }).click();
  const rename = page.getByRole("dialog", { name: "Rename chip" });
  await rename.getByRole("textbox", { name: "Name" }).fill(LONG_NAME);
  await rename.getByRole("button", { name: "Save" }).click();
  await selectOnCanvas(page, /cannot fit 1 selected/u);
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Look inside" }).click();

  const current = chipPath(page).locator('[aria-current="page"]');
  await expect(current).toHaveText(LONG_NAME);
  expect(await current.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

/** The library panel or sheet, whichever the width shows. */
const libraryPanel = (page: Page): Locator =>
  page
    .getByRole("region", { name: "Chip library" })
    .or(page.getByRole("dialog", { name: "Chip library" }));

/** Makes a folder from the panel's "New folder" (top level) or a row's "New folder inside…". */
const makeFolder = async (page: Page, name: string, inside?: string): Promise<void> => {
  if (inside === undefined) {
    await libraryPanel(page).getByRole("button", { name: "New folder", exact: true }).click();
  } else {
    await libraryTree(page)
      .getByRole("button", { name: `Actions for ${inside}`, exact: true })
      .click();
    await page.getByRole("menuitem", { name: "New folder inside…" }).click();
  }
  const dialog = page.getByRole("dialog", { name: "New folder" });
  await dialog.getByRole("textbox", { name: "Folder name" }).fill(name);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);
};

/** Picks `option` in the dialog's Folder select. */
const chooseFolder = async (dialog: Locator, option: string): Promise<void> => {
  await dialog.getByRole("button", { name: /Folder/u }).click();
  await dialog.page().getByRole("option", { name: option, exact: true }).click();
};

test("the first save asks for a folder, files the chip there and saves it", async ({ page }) => {
  await createProject(page);
  await openLibrary(page);
  await makeFolder(page, "Arithmetic");
  await makeFolder(page, "Adders", "Arithmetic");

  await libraryPanel(page).getByRole("button", { name: "New chip", exact: true }).click();
  const created = page.getByRole("dialog", { name: "New chip" });
  await created.getByRole("textbox", { name: "Name" }).fill("Half adder");
  await created.getByRole("button", { name: "Save" }).click();
  await expect(created).toHaveCount(0);
  await expect(chipPath(page).locator('[aria-current="page"]')).toHaveText("Half adder");

  await saveButton(page).click();
  const dialog = page.getByRole("dialog", { name: "Save Half adder" });
  await expect(dialog).toContainText("Pick its folder. You can move it later.");
  await chooseFolder(dialog, "Arithmetic › Adders");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(outcome(page, "Saved Half adder")).toBeAttached();
  await expect(unsavedDot(page)).toHaveCount(0);

  // In the folder, saved (no "draft only" badge) and placeable.
  // New chip leaves a phone's sheet closed and a column open.
  const tree =
    (await libraryToggle(page).getAttribute("aria-expanded")) === "true"
      ? libraryTree(page)
      : await openLibrary(page);
  await page.getByRole("searchbox", { name: "Search chips" }).fill("adders");
  const row = libraryRow(tree, "Half adder");
  await expect(row).toBeVisible();
  await expect(row.getByText("draft only")).toHaveCount(0);
  await expect(row.getByText("Unsaved changes")).toHaveCount(0);
});

test("a saved chip with edits shows the dot on its library row, and its parent does not", async ({
  page,
}) => {
  await importSaveFlow(page);
  await moveNand(page);
  const tree = await openLibrary(page);
  await expect(libraryRow(tree, "Half adder").getByText("Unsaved changes")).toBeAttached();
  await expect(libraryRow(tree, "Full adder").getByText("Unsaved changes")).toHaveCount(0);
  // A never-saved chip keeps its badge and shows no dot (D10).
  const scratch = libraryRow(tree, "Scratch");
  await expect(scratch.getByText("draft only")).toBeVisible();
  await expect(scratch.getByText("Unsaved changes")).toHaveCount(0);
});
