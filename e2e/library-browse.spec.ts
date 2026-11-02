import { readFile } from "node:fs/promises";

import { importLibrary, LIBRARY, libraryRow, openLibrary } from "./library-support";
import { canvasHost, expect, test } from "./support";

const NOT_SAVED = "Save this chip before placing it in another chip.";
const LONG_NAME_LENGTH = 60;
const PHONE = { width: 320, height: 640 };
/** The layout's breakpoint: below it the library is a sheet. */
const WIDE = 640;

test("the library lists the built-ins first and opens folders", async ({ page }) => {
  await importLibrary(page);
  const tree = await openLibrary(page);
  await expect(tree.getByRole("row").first()).toContainText("Built-in");
  await expect(libraryRow(tree, "Half adder")).toHaveCount(0);
  await libraryRow(tree, "Arithmetic").click();
  await libraryRow(tree, "Adders").click();
  await expect(libraryRow(tree, "Half adder")).toBeVisible();
});

test("searching by path, colour and the starred filter narrows the tree", async ({ page }) => {
  await importLibrary(page);
  const tree = await openLibrary(page);
  const search = page.getByRole("searchbox", { name: "Search chips" });

  await search.fill("adders");
  await expect(libraryRow(tree, "Half adder")).toBeVisible();
  await expect(libraryRow(tree, "Logic")).toHaveCount(0);

  await search.fill("red");
  await expect(libraryRow(tree, "XOR")).toBeVisible();

  await search.fill("");
  await page.getByRole("button", { name: "Starred" }).click();
  await expect(libraryRow(tree, "XOR")).toBeVisible();
  for (const hidden of ["Built-in", "Half adder", "Scratch", "Main"]) {
    await expect(libraryRow(tree, hidden)).toHaveCount(0);
  }
});

test("a draft-only chip is greyed out with the reason it can't be placed", async ({ page }) => {
  await importLibrary(page);
  const tree = await openLibrary(page);
  const scratch = libraryRow(tree, "Scratch");
  await expect(scratch).toHaveAttribute("data-unavailable", "true");
  await expect(scratch).toHaveAccessibleDescription(NOT_SAVED);
  await expect(scratch).toContainText(NOT_SAVED);
  await expect(scratch).toContainText("draft only");
});

test("a long chip name truncates instead of widening a 320 px phone", async ({ page }) => {
  await page.setViewportSize(PHONE);
  const longName = "S".repeat(LONG_NAME_LENGTH);
  const text = await readFile(LIBRARY, "utf-8");
  await importLibrary(page, {
    name: "library.json",
    mimeType: "application/json",
    buffer: Buffer.from(text.replace('"Scratch"', `"${longName}"`)),
  });
  const tree = await openLibrary(page);
  const row = libraryRow(tree, longName);
  await expect(row).toBeVisible();
  const box = await row.boundingBox();
  expect(box === null ? Number.POSITIVE_INFINITY : box.x + box.width).toBeLessThanOrEqual(
    PHONE.width,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    PHONE.width,
  );
});

test("a press on a part arms it, and a press on the armed row disarms it", async ({ page }) => {
  await importLibrary(page);
  const isPhone = (page.viewportSize()?.width ?? 0) < WIDE;
  let tree = await openLibrary(page);
  await libraryRow(tree, "Built-in").click();
  await libraryRow(tree, "NAND").click();
  if (isPhone) {
    // The sheet closes so the canvas can be tapped; open it again to see the row.
    await expect(page.getByRole("button", { name: "Library", exact: true })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    tree = await openLibrary(page);
  }
  const nand = libraryRow(tree, "NAND");
  await expect(nand).toHaveAttribute("aria-current", "true");
  await expect(nand).toContainText("Armed");
  await nand.click();
  await expect(nand).not.toHaveAttribute("aria-current", "true");
  await expect(nand).not.toContainText("Armed");
});

const MAX_TABS = 6;

test("a row that can't be placed takes keyboard focus, and Enter on it places nothing", async ({
  page,
}) => {
  await importLibrary(page);
  const tree = await openLibrary(page);
  await page.getByRole("searchbox", { name: "Search chips" }).focus();
  const firstRow = tree.getByRole("row").first();
  for (let step = 0; step < MAX_TABS; step += 1) {
    if (await firstRow.evaluate((row) => row === document.activeElement)) {
      break;
    }
    await page.keyboard.press("Tab");
  }
  await expect(firstRow).toBeFocused();
  // Built-in, Arithmetic, Logic, Main, then Scratch.
  await page.keyboard.press("End");
  const scratch = libraryRow(tree, "Scratch");
  await expect(scratch).toBeFocused();
  await expect(scratch).toHaveAccessibleDescription(NOT_SAVED);

  await page.keyboard.press("Enter");
  await expect(scratch).not.toHaveAttribute("aria-current", "true");
  await expect(tree.getByText("Armed", { exact: true })).toHaveCount(0);
  // Placing a part is an undo step; nothing was placed.
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  await expect(scratch).toBeFocused();
});

test("a long library scrolls in its column and leaves the canvas height alone", async ({
  page,
}) => {
  test.skip((page.viewportSize()?.width ?? 0) < WIDE, "On phones the library is a sheet.");
  await importLibrary(page);
  const canvas = canvasHost(page);
  const pageHeight = () => page.evaluate(() => document.documentElement.scrollHeight);
  const before = await canvas.boundingBox();
  const heightBefore = await pageHeight();
  const tree = await openLibrary(page);
  for (const folder of ["Built-in", "Arithmetic", "Adders", "Logic"]) {
    await libraryRow(tree, folder).click();
  }
  await expect(libraryRow(tree, "Half adder")).toBeVisible();
  const after = await canvas.boundingBox();
  expect(after?.height).toBe(before?.height);
  expect(await pageHeight()).toBe(heightBefore);
});
