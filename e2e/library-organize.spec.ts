import type { Locator, Page } from "@playwright/test";

import { chooseOption, focusRow, pressButton, rowMenu, typeInto } from "./library-keys";
import { importLibrary, libraryRow, openLibrary } from "./library-support";
import { expect, test } from "./support";

/** The layout's breakpoint: below it the library is a sheet. */
const WIDE = 640;
const TWO_INPUT = "Gates › Two input";
/** The fixture's draft-only "Scratch". */
const SCRATCH_ID = "00000000-0000-4000-8000-000000000404";

const libraryPanel = (page: Page): Locator => page.getByRole("region", { name: "Chip library" });

/** "New folder" above the tree (or "New folder inside…" from a row), named from the keyboard. */
const nameFolder = async (page: Page, name: string): Promise<void> => {
  const dialog = page.getByRole("dialog", { name: "New folder" });
  await typeInto(page, dialog, { label: "Folder name", text: name });
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
};

/** The keyboard flows run on desktop Chrome. */
const keyboardOnly = ({
  browserName,
  isMobile,
}: {
  readonly browserName: string;
  readonly isMobile: boolean;
}): void => {
  test.skip(browserName !== "chromium" || isMobile, "Keyboard flows run on desktop Chrome");
};

test("folders are made, nested, filled, guarded and deleted", async ({
  page,
  browserName,
  isMobile,
}) => {
  keyboardOnly({ browserName, isMobile });
  await importLibrary(page);
  const tree = await openLibrary(page);
  await pressButton(page, libraryPanel(page), "New folder");
  await nameFolder(page, "Gates");
  await rowMenu(page, { tree, row: "Gates", item: "New folder inside…" });
  await nameFolder(page, "Two input");

  await focusRow(page, tree, "Logic");
  await page.keyboard.press("ArrowRight");
  await rowMenu(page, { tree, row: "XOR", item: "Move to…" });
  const moveXor = page.getByRole("dialog", { name: "Move XOR" });
  await chooseOption(page, moveXor, { label: "Folder", option: TWO_INPUT });
  await pressButton(page, moveXor, "Save");
  await expect(moveXor).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Search chips" }).fill("two input");
  await expect(libraryRow(tree, "XOR")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search chips" }).fill("");

  await rowMenu(page, { tree, row: "Gates", item: "Move to…" });
  const moveGates = page.getByRole("dialog", { name: "Move Gates" });
  await moveGates.getByRole("button", { name: /Folder/u }).press("Enter");
  await expect(page.getByRole("option", { name: "Logic", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: TWO_INPUT })).toHaveCount(0);
  await expect(page.getByRole("option", { name: "Gates", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await pressButton(page, moveGates, "Cancel");

  await rowMenu(page, { tree, row: "Gates", item: "Delete" });
  await expect(libraryRow(tree, "Gates")).toHaveCount(0);
  await focusRow(page, tree, "Two input");
  await page.keyboard.press("ArrowRight");
  await expect(libraryRow(tree, "XOR")).toBeVisible();
  await expect(libraryRow(tree, "Two input")).toHaveAttribute("aria-level", "1");
});

test("deleting a chip asks first, and a chip in use stays", async ({
  page,
  browserName,
  isMobile,
}) => {
  keyboardOnly({ browserName, isMobile });
  await importLibrary(page);
  const tree = await openLibrary(page);
  await focusRow(page, tree, "Arithmetic");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await rowMenu(page, { tree, row: "Half adder", item: "Delete" });
  const deleteHalf = page.getByRole("dialog", { name: "Delete Half adder?" });
  await expect(deleteHalf).toContainText("This can't be undone.");
  await pressButton(page, deleteHalf, "Delete");
  await expect(deleteHalf.getByRole("alert")).toHaveText("Used in Full adder");
  await pressButton(page, deleteHalf, "Cancel");
  await expect(libraryRow(tree, "Half adder")).toBeVisible();

  await rowMenu(page, { tree, row: "Scratch", item: "Delete" });
  const deleteScratch = page.getByRole("dialog", { name: "Delete Scratch?" });
  await pressButton(page, deleteScratch, "Delete");
  await expect(deleteScratch).toHaveCount(0);
  await expect(libraryRow(tree, "Scratch")).toHaveCount(0);
});

test("a new chip filed in a folder opens in the editor", async ({
  page,
  browserName,
  isMobile,
}) => {
  keyboardOnly({ browserName, isMobile });
  await importLibrary(page);
  const tree = await openLibrary(page);
  const before = new URL(page.url()).searchParams.get("chip");
  await pressButton(page, libraryPanel(page), "New chip");
  const dialog = page.getByRole("dialog", { name: "New chip" });
  await typeInto(page, dialog, { label: "Name", text: "Sumador" });
  await chooseOption(page, dialog, { label: "Folder", option: "Arithmetic" });
  await pressButton(page, dialog, "Save");
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get("chip")).not.toBe(before);
  await expect(page.getByRole("heading", { name: "Pins 0" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search chips" }).fill("arithmetic");
  await expect(libraryRow(tree, "Sumador")).toBeVisible();
});

/** Opens the row's "⋯" menu with a press and picks `item`. */
const pressRowMenu = async (tree: Locator, row: string, item: string): Promise<void> => {
  await tree.getByRole("button", { name: `Actions for ${row}`, exact: true }).click();
  await tree.page().getByRole("menuitem", { name: item }).click();
};

test("deleting the armed chip stops placing it", async ({ page }) => {
  await importLibrary(page);
  const isPhone = (page.viewportSize()?.width ?? 0) < WIDE;
  let tree = await openLibrary(page);
  await libraryRow(tree, "Logic").click();
  await libraryRow(tree, "XOR").click();
  const banner = page.getByText("Tap the canvas to place XOR");
  await expect(banner).toBeVisible();
  if (isPhone) {
    tree = await openLibrary(page);
  }
  await pressRowMenu(tree, "XOR", "Delete");
  await page
    .getByRole("dialog", { name: "Delete XOR?" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(libraryRow(tree, "XOR")).toHaveCount(0);
  await expect(banner).toHaveCount(0);
});

test("Open from a row's menu opens that chip", async ({ page }) => {
  await importLibrary(page);
  const isPhone = (page.viewportSize()?.width ?? 0) < WIDE;
  const tree = await openLibrary(page);
  await pressRowMenu(tree, "Scratch", "Open");
  await expect.poll(() => new URL(page.url()).searchParams.get("chip")).toBe(SCRATCH_ID);
  await expect(page.getByRole("button", { name: "Library", exact: true })).toHaveAttribute(
    "aria-expanded",
    String(!isPhone),
  );
});

test("a right-click on a row opens its menu", async ({ page, isMobile }) => {
  test.skip(isMobile, "Phones open the menu with a long-press (Task 10)");
  await importLibrary(page);
  const tree = await openLibrary(page);
  await libraryRow(tree, "Scratch").click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Tags…" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Star" }).click();
  await expect(libraryRow(tree, "Scratch")).toContainText("Starred");
});
