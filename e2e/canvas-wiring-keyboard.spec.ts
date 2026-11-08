import path from "node:path";

import type { Page } from "@playwright/test";

import {
  canvasHost,
  createProject,
  DEMO_PART,
  expect,
  exportedProject,
  spoken,
  test,
} from "./support";
import { inputBWire, NAND_B, press, tabToCanvas, wireInto } from "./wiring-support";

/**
 * The demo as it was first laid out, with the output on the grid (320, 40) rather than half a grid
 * down in line with the NAND. Grid steps can then move the output across the straight B → b run.
 */
const GRID_DEMO = path.join(
  import.meta.dirname,
  "..",
  "src",
  "features",
  "projects",
  "fixtures",
  "v1-demo.json",
);

const importGridDemo = async (page: Page): Promise<void> => {
  await createProject(page);
  const chooserEvent = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import" }).click();
  const chooser = await chooserEvent;
  await chooser.setFiles(GRID_DEMO);
  await expect(page.getByRole("heading", { level: 1, name: "Demo" })).toBeAttached();
};

/** `]` from nothing: Input A, Input B, then the NAND. */
const STEPS_TO_NAND = 3;
/** `p` from no card: the NAND's a, then b. */
const STEPS_TO_PIN_B = 2;
/** The NAND's wires in circuit order: A → a, B → b, out → OUT. */
const STEPS_TO_WIRE_INTO_B = 2;
/** Six grid steps left and one down put the output piece (320, 40) at (80, 80), over B → b. */
const OUTPUT_LEFT = 6;

/** Tabs to the canvas and selects the NAND with `]`. */
const selectNand = async (page: Page): Promise<void> => {
  await tabToCanvas(page);
  await press(page, "]", STEPS_TO_NAND);
  await expect(spoken(page)).toHaveText(/NAND gate 1 selected/u);
};

/** Opens the menu of the selected wire with Enter; focus is in it. */
const openWireMenu = async (page: Page) => {
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu", { name: "Wire actions" });
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  return menu;
};

test("from the keyboard: n reaches the wire into b, its menu deletes it, then w and Enter wire B to b", async ({
  page,
}) => {
  await createProject(page);
  await selectNand(page);
  await press(page, "n", STEPS_TO_WIRE_INTO_B);
  await expect(spoken(page)).toHaveText(/Wire from B of B to b of NAND gate 1/u);
  const menu = await openWireMenu(page);
  await page.keyboard.press("End");
  await expect(menu.getByRole("menuitem", { name: "Delete" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(spoken(page)).toHaveText(/Items deleted: 1/u);
  await expect(canvasHost(page)).toBeFocused();
  expect(inputBWire(await exportedProject(page))).toBeUndefined();

  await canvasHost(page).focus();
  await page.keyboard.press("[");
  await expect(spoken(page)).toHaveText(/^B selected\s*$/u);
  await page.keyboard.press("p");
  await page.keyboard.press("w");
  await expect(spoken(page)).toHaveText(/B of B ready to wire/u);
  await page.keyboard.press("]");
  await expect(spoken(page)).toHaveText(/NAND gate 1 selected/u);
  await press(page, "p", STEPS_TO_PIN_B);
  await expect(spoken(page)).toHaveText(/Pin b of NAND gate 1/u);
  await page.keyboard.press("Enter");
  await expect(spoken(page)).toHaveText(/Wire added/u);
  expect(inputBWire(await exportedProject(page))).toBeDefined();

  await canvasHost(page).focus();
  await page.keyboard.press("w");
  await expect(spoken(page)).toHaveText(/ready to wire/u);
  await page.keyboard.press("Escape");
  await expect(spoken(page)).toHaveText(/Wiring cancelled/u);
});

test("from the keyboard: n, Enter and Colour… paint one wire Blue", async ({ page }) => {
  await createProject(page);
  await selectNand(page);
  await page.keyboard.press("n");
  await expect(spoken(page)).toHaveText(/Wire from A of A to a of NAND gate 1/u);
  const menu = await openWireMenu(page);
  await expect(menu.getByRole("menuitem", { name: "Colour…" })).toBeFocused();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Wire colour" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("radio", { name: "Default" })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("radio", { name: "Blue" })).toBeChecked();
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(canvasHost(page)).toBeFocused();

  const file = await exportedProject(page);
  expect(wireInto(file, DEMO_PART.nand, 0)?.color).toBe("blue");
  expect(wireInto(file, DEMO_PART.nand, NAND_B)?.color).toBeUndefined();
});

test("Tidy wires straightens a detour left behind by a moved chip, and keeps a hand-bent wire", async ({
  page,
}) => {
  await importGridDemo(page);
  await selectNand(page);
  // Bend the wire into a by hand: n, Enter, Move bends (ArrowDown, Enter), then its interior run one cell left.
  await page.keyboard.press("n");
  const menu = await openWireMenu(page);
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Move bends" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(spoken(page)).toHaveText(/Moving bends/u);
  await canvasHost(page).focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Escape");
  await expect(spoken(page)).toHaveText(/Bends done/u);

  /*
   * Move the output over the straight B → b wire, which then detours below it; then jump the
   * output four grid steps further down, clear of the detour.
   */
  await press(page, "]", 1);
  await expect(spoken(page)).toHaveText(/^OUT selected\s*$/u);
  await press(page, "ArrowLeft", OUTPUT_LEFT);
  await page.keyboard.press("ArrowDown");
  const detour = wireInto(await exportedProject(page), DEMO_PART.nand, NAND_B)?.waypoints;
  expect(detour).not.toEqual([]);
  await canvasHost(page).focus();
  await page.keyboard.press("Shift+ArrowDown");
  await expect(spoken(page)).toHaveText(/Chips moved: 1/u);
  /*
   * The output no longer blocks the straight run, but a move never re-routes a wire it does not
   * newly block, so the detour stays until Tidy.
   */
  const before = await exportedProject(page);
  const bent = wireInto(before, DEMO_PART.nand, 0);
  expect(bent?.manualWaypoints).toBe(true);
  expect(wireInto(before, DEMO_PART.nand, NAND_B)?.waypoints).toEqual(detour);

  await page.getByRole("button", { name: "Tidy wires" }).click();
  const after = await exportedProject(page);
  // The detour is gone, back to the straight run; the hand-bent wire is untouched.
  expect(wireInto(after, DEMO_PART.nand, NAND_B)?.waypoints).toEqual([]);
  expect(wireInto(after, DEMO_PART.nand, 0)).toEqual(bent);
});
