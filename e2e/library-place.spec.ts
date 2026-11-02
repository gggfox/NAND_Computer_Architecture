/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Page } from "@playwright/test";

import { focusRow, pressUntilFocused } from "./library-keys";
import {
  importLibrary,
  libraryRow,
  libraryToggle,
  libraryTree,
  openLibrary,
  placingBanner,
} from "./library-support";
import { canvasHost, expect, exportedProject, GRID, spoken, test, worldToPage } from "./support";
import type { ExportedFile, Point } from "./support";
import { pointerFor } from "./wiring-support";

/*
 * Placing from the library (D6): a phone arms a chip with a tap and places it with more taps; the
 * keyboard places at the centre of the view; arming a wire pin stops a placement.
 */

const PHONES = new Set(["mobile-chrome", "mobile-safari"]);
/** Two empty spots on the canvas, in world units, far enough apart for two Half adders. */
const FIRST_SPOT: Point = { x: 120, y: 80 };
const SECOND_SPOT: Point = { x: 120, y: 200 };
const TWO = 2;
/** A NAND is 120 × 80 (`bodySize` in `domain/chip-layout.ts`): its centre's offset. */
const NAND_CENTRE: Point = { x: 60, y: 40 };
const HALF = 0.5;

/** The open chip "Main"'s draft parts. */
const mainParts = (
  file: ExportedFile,
): ExportedFile["project"]["chips"][number]["draft"]["instances"] =>
  file.project.chips.find((chip) => chip.name === "Main")?.draft.instances ?? [];

/** The centre of the drawing canvas, as a viewport point. */
const viewCentre = async (page: Page): Promise<Point> => {
  const box = await canvasHost(page).locator("canvas").first().boundingBox();
  if (box === null) {
    throw new Error("The canvas is not visible");
  }
  return { x: box.x + box.width * HALF, y: box.y + box.height * HALF };
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

test("on a phone, taps alone find Half adder, place two and stop placing", async ({
  page,
}, testInfo) => {
  test.skip(!PHONES.has(testInfo.project.name), "The tap path runs on the phone projects");
  await importLibrary(page);
  const toggle = libraryToggle(page);
  await toggle.tap();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const search = page.getByRole("searchbox", { name: "Search chips" });
  await search.tap();
  await page.keyboard.type("adders");
  const halfAdder = libraryRow(libraryTree(page), "Half adder");
  await halfAdder.tap();

  // The sheet gets out of the way and the banner says what a tap does.
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(placingBanner(page, "Half adder")).toBeVisible();
  const pointer = pointerFor(page, true);
  await pointer.tap(await worldToPage(page, FIRST_SPOT));
  await pointer.tap(await worldToPage(page, SECOND_SPOT));
  await expect(placingBanner(page, "Half adder")).toBeVisible();

  await page.getByRole("button", { name: "Done", exact: true }).tap();
  await expect(placingBanner(page, "Half adder")).toHaveCount(0);
  const parts = mainParts(await exportedProject(page));
  expect(parts.filter((part) => part.kind.type === "custom")).toHaveLength(TWO);
});

test("from the keyboard, Enter on NAND places one at the centre of the view", async ({
  page,
  browserName,
  isMobile,
}) => {
  keyboardOnly({ browserName, isMobile });
  await importLibrary(page);
  const tree = await openLibrary(page);
  await focusRow(page, tree, "Built-in");
  await page.keyboard.press("ArrowRight");
  const nand = tree.getByRole("row", { name: "NAND", exact: true });
  await pressUntilFocused(page, "ArrowDown", nand);
  await page.keyboard.press("Enter");
  await expect(spoken(page)).toHaveText(/NAND/u);

  // Escape with nothing armed changes nothing: the library stays open, the row keeps focus.
  await page.keyboard.press("Escape");
  await expect(libraryToggle(page)).toHaveAttribute("aria-expanded", "true");
  await expect(nand).toBeFocused();
  await expect(tree.getByText("Armed", { exact: true })).toHaveCount(0);

  const [placed, ...more] = mainParts(await exportedProject(page));
  expect(more).toEqual([]);
  expect(placed?.kind.type).toBe("nand");
  if (placed === undefined) {
    return;
  }
  const centre = await worldToPage(page, {
    x: placed.position.x + NAND_CENTRE.x,
    y: placed.position.y + NAND_CENTRE.y,
  });
  const view = await viewCentre(page);
  expect(Math.abs(centre.x - view.x)).toBeLessThanOrEqual(GRID);
  expect(Math.abs(centre.y - view.y)).toBeLessThanOrEqual(GRID);
});

test("arming a wire pin stops placing XOR", async ({ page, browserName, isMobile }) => {
  keyboardOnly({ browserName, isMobile });
  await importLibrary(page);
  const tree = await openLibrary(page);
  // A NAND to wire from: arm it, tap the canvas once, and stop.
  await libraryRow(tree, "Built-in").click();
  await libraryRow(tree, "NAND").click();
  const at = await worldToPage(page, FIRST_SPOT);
  await page.mouse.click(at.x, at.y);
  await page.getByRole("button", { name: "Done", exact: true }).click();

  await libraryRow(tree, "Logic").click();
  await libraryRow(tree, "XOR").click();
  await expect(placingBanner(page, "XOR")).toBeVisible();
  await canvasHost(page).focus();
  await page.keyboard.press("]");
  await expect(spoken(page)).toHaveText(/NAND gate 1 selected/u);
  await page.keyboard.press("p");
  await page.keyboard.press("w");
  await expect(spoken(page)).toHaveText(/ready to wire/u);
  await expect(placingBanner(page, "XOR")).toHaveCount(0);
});

test("Escape in the library stops a placement armed by a click", async ({
  page,
  browserName,
  isMobile,
}) => {
  keyboardOnly({ browserName, isMobile });
  await importLibrary(page);
  const tree = await openLibrary(page);
  await libraryRow(tree, "Logic").click();
  await libraryRow(tree, "XOR").click();
  await expect(placingBanner(page, "XOR")).toBeVisible();
  // Focus stays on the row the click armed, in the library column.
  await expect(libraryRow(tree, "XOR")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(placingBanner(page, "XOR")).toHaveCount(0);
  await expect(libraryToggle(page)).toHaveAttribute("aria-expanded", "true");
});
