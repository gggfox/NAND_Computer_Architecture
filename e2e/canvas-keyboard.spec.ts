/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import path from "node:path";

import type { Page } from "@playwright/test";

import {
  canvasHost,
  createProject,
  expect,
  exportedProject,
  NAND_AT,
  NAND_MOVED,
  nandPosition,
  spoken,
  test,
} from "./support";

const MAX_TABS = 40;
/** A project whose open chip holds one instance of the custom chip "Inner", at (0, 0). */
const CUSTOM_CHIP = path.join(import.meta.dirname, "fixtures", "custom-chip.json");
/** `]` steps through the parts in canvas order: Input A, Input B, then the NAND. */
const STEPS_TO_NAND = 3;

/** Tabs until the canvas host has focus, as a keyboard user reaches it. */
const tabToCanvas = async (page: Page): Promise<void> => {
  const host = canvasHost(page);
  for (let step = 0; step < MAX_TABS; step += 1) {
    await page.keyboard.press("Tab");
    if (await host.evaluate((element) => element === document.activeElement)) {
      return;
    }
  }
  throw new Error(`The canvas was not reached within ${String(MAX_TABS)} Tab presses`);
};

const selectNand = async (page: Page): Promise<void> => {
  await tabToCanvas(page);
  for (let step = 0; step < STEPS_TO_NAND; step += 1) {
    await page.keyboard.press("]");
  }
  await expect(spoken(page)).toHaveText(/NAND gate 1 selected/u);
};

test("select, move, undo, delete and redo the NAND from the keyboard", async ({ page }) => {
  await createProject(page);
  await selectNand(page);
  await expect(page.getByText("selected", { exact: true })).toHaveCount(1);

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(spoken(page)).toHaveText(/Chips moved: 1/u);
  expect(nandPosition(await exportedProject(page))).toEqual(NAND_MOVED);

  // Each arrow press is its own undo step.
  await canvasHost(page).focus();
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+z");
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  expect(nandPosition(await exportedProject(page))).toEqual(NAND_AT);

  await canvasHost(page).focus();
  await page.keyboard.press("Delete");
  await expect(spoken(page)).toHaveText(/Items deleted: 1/u);
  await expect(page.getByText("NAND gate 1", { exact: true })).toHaveCount(0);

  await page.keyboard.press("Control+z");
  await expect(page.getByText("NAND gate 1", { exact: true })).toBeVisible();
  // Undo restores the part, not the selection.
  await expect(page.getByText("selected", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Control+Shift+z");
  await expect(page.getByText("NAND gate 1", { exact: true })).toHaveCount(0);
});

test("Enter opens the chip menu and Escape gives focus back to the canvas", async ({ page }) => {
  await createProject(page);
  await selectNand(page);
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu", { name: "Chip actions" });
  await expect(menu).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Delete" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(canvasHost(page)).toBeFocused();
});

test("P announces the selected chip's first pin", async ({ page }) => {
  await createProject(page);
  await selectNand(page);
  await page.keyboard.press("p");
  await expect(spoken(page)).toHaveText(/Pin a of NAND gate 1: [01?]\. Connections: 1/u);
});

test("? opens the keyboard help, and Tab still leaves the canvas", async ({ page }) => {
  await createProject(page);
  await tabToCanvas(page);
  await page.keyboard.press("?");
  const help = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(help).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(help).toHaveCount(0);
  await expect(canvasHost(page)).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(canvasHost(page)).not.toBeFocused();
  await expect(page.locator(":focus")).toHaveCount(1);
});

/** Imports the custom-chip fixture, selects its one instance from the keyboard and opens its menu. */
const openCustomChipMenu = async (page: Page): Promise<void> => {
  await createProject(page);
  const chooserEvent = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import" }).click();
  const chooser = await chooserEvent;
  await chooser.setFiles(CUSTOM_CHIP);
  await expect(page.getByText("Inner 1", { exact: true })).toBeAttached();
  await canvasHost(page).focus();
  await page.keyboard.press("]");
  await expect(spoken(page)).toHaveText(/Inner 1 selected/u);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu", { name: "Chip actions" })).toBeVisible();
};

test("keys typed in the rename dialog stay in it, out of the canvas keymap", async ({ page }) => {
  await openCustomChipMenu(page);
  await page.getByRole("menuitem", { name: "Rename chip…" }).click();
  const dialog = page.getByRole("dialog", { name: "Rename chip" });
  const name = dialog.getByRole("textbox", { name: "Name" });
  await name.focus();
  // Ctrl+A selects the text, not every chip; Space, v, h, p, brackets and ? are typed, not run.
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Half v[h]p?x");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  // Backspace deletes a letter, not the selected chip; Enter submits, not opens the chip menu.
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("menu", { name: "Chip actions" })).toHaveCount(0);

  const file = await exportedProject(page);
  expect(file.project.chips.map((chip) => chip.name)).toEqual(["Main", "Half v[h]p?"]);
  expect(file.project.chips[0]?.draft.instances).toEqual([
    { kind: { type: "custom" }, position: { x: 0, y: 0 } },
  ]);
});

test("arrow keys in the recolor dialog never move the chip", async ({ page }) => {
  await openCustomChipMenu(page);
  await page.getByRole("menuitem", { name: "Recolor chip…" }).click();
  const dialog = page.getByRole("dialog", { name: "Recolor chip" });
  await dialog.getByRole("radio", { checked: true }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  // The swatches handle their own arrows; a button does not, so its arrows bubble out too.
  const cancel = dialog.getByRole("button", { name: "Cancel" });
  await cancel.focus();
  await page.keyboard.press("ArrowRight");
  await cancel.click();
  await expect(dialog).toHaveCount(0);

  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  const file = await exportedProject(page);
  expect(file.project.chips[0]?.draft.instances[0]?.position).toEqual({ x: 0, y: 0 });
});
