import type { Locator, Page } from "@playwright/test";

import {
  canvasHost,
  chipCenter,
  createProject,
  DEMO_PART,
  expect,
  exportedProject,
  spoken,
  test,
  touch,
} from "./support";

/*
 * Duplicate and Array (phase 5a): the selection bar, the Array dialog, Ctrl/⌘+D, and the rules the
 * plan pins: one undo step per action, the clipboard untouched, and the bar out of the way of a
 * wire being drawn.
 */

const NANDS = /^NAND gate \d+$/u;
const FIRST_COPIES = 15;
const GRID_CHIPS = 16;
const DEMO_PARTS = 4;
const DEMO_WIRES = 3;
const TWICE = 2;
const PARTS_AFTER_PASTE = DEMO_PARTS + TWICE;
/** From the NAND's centre to a point clear of the bar over input A. */
const NAND_RIGHT_HALF = 40;

const nands = (page: Page) => page.getByText(NANDS);
const bar = (page: Page) => page.getByRole("toolbar", { name: "Selection actions" });
const arrayDialog = (page: Page) => page.getByRole("dialog", { name: "Array" });

/** Types the copies count and commits it: the number field applies its value on blur. */
const setCopies = async (dialog: Locator, count: number): Promise<void> => {
  const field = dialog.getByRole("textbox", { name: "Copies" });
  await field.fill(String(count));
  await field.blur();
};

/** Selects the demo NAND with the pointer: a click on the desktop, a tap on touch projects. */
const selectNand = async (page: Page, isMobile: boolean): Promise<void> => {
  const at = await chipCenter(page, DEMO_PART.nand);
  await (isMobile
    ? touch(page, [
        { type: "down", id: 1, at },
        { type: "up", id: 1, at },
      ])
    : page.mouse.click(at.x, at.y));
  await expect(spoken(page)).toHaveText(/NAND gate 1 selected/u);
};

/** Selects everything with Ctrl/⌘+A (the canvas focused first). */
const selectAll = async (page: Page): Promise<void> => {
  await canvasHost(page).focus();
  await page.keyboard.press("ControlOrMeta+a");
  await expect(bar(page)).toBeVisible();
};

const counts = async (page: Page): Promise<{ parts: number; wires: number }> => {
  const file = await exportedProject(page);
  const draft = file.project.chips[0]?.draft;
  return { parts: draft?.instances.length ?? 0, wires: draft?.wires.length ?? 0 };
};

test("an Array of 15 NAND copies in a 4 x 4 grid is one undo step", async ({ page, isMobile }) => {
  test.skip(isMobile, "The phone flow below covers this with taps");
  await createProject(page);
  await selectNand(page, false);
  await bar(page).getByRole("button", { name: "Array…" }).click();
  const dialog = arrayDialog(page);
  await dialog.getByRole("button", { name: /Direction/u }).click();
  await page.getByRole("option", { name: "Grid", exact: true }).click();
  await setCopies(dialog, FIRST_COPIES);
  await expect(dialog.getByText("4 × 4, 16 chips")).toBeVisible();
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(nands(page)).toHaveCount(GRID_CHIPS);
  await expect(spoken(page)).toHaveText(/Chips added in an array: 15/u);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(nands(page)).toHaveCount(1);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(nands(page)).toHaveCount(GRID_CHIPS);
});

for (const modifier of ["Control", "Meta"]) {
  test(`${modifier}+D duplicates the wired selection and selects the copies`, async ({ page }) => {
    await createProject(page);
    await selectAll(page);
    await page.keyboard.press(`${modifier}+d`);
    await expect(spoken(page)).toHaveText(/Chips duplicated: 4/u);
    await expect(nands(page)).toHaveCount(TWICE);
    expect(await counts(page)).toEqual({ parts: DEMO_PARTS * TWICE, wires: DEMO_WIRES * TWICE });
    // The copies, not the originals, are selected.
    await expect(page.getByText("selected", { exact: true })).toHaveCount(DEMO_PARTS);
  });
}

test("Duplicate leaves the clipboard alone: copy A, duplicate B, paste gives A", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Needs the keyboard");
  await createProject(page);
  const input = await chipCenter(page, DEMO_PART.inputA);
  await page.mouse.click(input.x, input.y);
  await expect(spoken(page)).toHaveText(/A selected/u);
  await page.keyboard.press("ControlOrMeta+c");
  await expect(spoken(page)).toHaveText(/Chips copied: 1/u);

  // Input A's bar sits over the NAND's centre, so press the NAND's right half instead.
  const nand = await chipCenter(page, DEMO_PART.nand);
  await page.mouse.click(nand.x + NAND_RIGHT_HALF, nand.y);
  await expect(spoken(page)).toHaveText(/NAND gate 1 selected/u);
  await page.keyboard.press("ControlOrMeta+d");
  await expect(nands(page)).toHaveCount(TWICE);

  await page.keyboard.press("ControlOrMeta+v");
  await expect(spoken(page)).toHaveText(/Chips pasted: 1/u);
  await expect(nands(page)).toHaveCount(TWICE);
  const after = await counts(page);
  expect(after.parts).toBe(PARTS_AFTER_PASTE);
});

test("the selection bar hides while a wire is armed and returns after Escape", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Needs the keyboard");
  await createProject(page);
  await selectNand(page, false);
  await expect(bar(page)).toBeVisible();
  await canvasHost(page).focus();
  await page.keyboard.press("w");
  await expect(bar(page)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(bar(page)).toBeVisible();
});

test("on a touch screen, Array works with taps only", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Touch projects only");
  await createProject(page);
  await selectNand(page, true);
  await bar(page).getByRole("button", { name: "Array…" }).tap();
  const dialog = arrayDialog(page);
  await dialog.getByRole("button", { name: /Direction/u }).tap();
  await page.getByRole("option", { name: "Grid", exact: true }).tap();
  await setCopies(dialog, FIRST_COPIES);
  await expect(dialog.getByText("4 × 4, 16 chips")).toBeVisible();
  await dialog.getByRole("button", { name: "Create" }).tap();
  await expect(nands(page)).toHaveCount(GRID_CHIPS);
});
