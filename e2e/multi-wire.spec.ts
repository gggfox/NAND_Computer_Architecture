/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import path from "node:path";

import type { Page } from "@playwright/test";

import {
  canvasHost,
  createProject,
  expect,
  exportedProject,
  spoken,
  test,
  worldToPage,
} from "./support";
import type { ExportedFile, Point } from "./support";
import { pressEditorTool } from "./toolbar-support";
import { instanceIds, pointerFor, usesTouch, wiresOf } from "./wiring-support";
import type { Pointer } from "./wiring-support";

/*
 * Wiring several pins at once (phase 5b): an Array of 16 RAM cells whose `clk` pins are picked
 * together and wired to one input in a single undo step, from the mouse, the keyboard and a
 * touch screen; bit by bit; and the refusal that leaves the circuit alone.
 */

const FIXTURES = path.join(import.meta.dirname, "fixtures");
const RAM_CELL = path.join(FIXTURES, "ram-cell.json");
const BIT_BUS = path.join(FIXTURES, "bit-bus.json");
const COPIES = 15;
const CELLS = 16;
const TWO = 2;

/** In `ram-cell.json`: the `clk` input piece's pin, the Cell's middle and its `clk` pin. */
const SOURCE: Point = { x: 40, y: 20 };
const CELL_MIDDLE: Point = { x: 220, y: 40 };
const CELL_CLK: Point = { x: 160, y: 60 };
/** One Cell down in a column Array: its height (80) plus the default spacing (one grid). */
const NEXT_ROW = 120;
/** In `bit-bus.json`: the 4-bit input D's pin, and the four outputs' pins. */
const BUS_PIN: Point = { x: 40, y: 80 };
const OUTPUT_PINS: readonly Point[] = [
  { x: 320, y: 20 },
  { x: 320, y: 100 },
  { x: 320, y: 180 },
  { x: 320, y: 260 },
];
/** The outputs are clicked in this order (first, third, fourth, second), so the third gets bit 0. */
const FIRST = 0;
const SECOND = 1;
const THIRD = 2;
const FOURTH = 3;
const CLICK_ORDER = [THIRD, FIRST, FOURTH, SECOND] as const;
const BITS = [FIRST, SECOND, THIRD, FOURTH] as const;

const bar = (page: Page) => page.getByRole("toolbar", { name: "Selection actions" });
const selectOnAll = (page: Page) =>
  page.getByRole("button", { name: "Select this pin on all selected chips" });
const notice = (page: Page) =>
  page.locator("p[aria-hidden=true]").filter({ hasText: /clk on Cell/u });

const importFixture = async (page: Page, file: string, name: string): Promise<void> => {
  await createProject(page);
  const chooserEvent = page.waitForEvent("filechooser");
  await pressEditorTool(page, "Import");
  const chooser = await chooserEvent;
  await chooser.setFiles(file);
  await expect(page.getByRole("heading", { level: 1, name })).toBeAttached();
};

const at = (page: Page, world: Point): Promise<Point> => worldToPage(page, world);

/** Selects the Cell and fills the Array dialog; `grid` makes 15 copies in 4 columns. */
const arrayOfCells = async (
  page: Page,
  pointer: Pointer,
  shape: { readonly direction: "Grid" | "Column"; readonly copies: number },
): Promise<void> => {
  await pointer.tap(await at(page, CELL_MIDDLE));
  await expect(bar(page)).toBeVisible();
  const open = bar(page).getByRole("button", { name: "Array…" });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Array" });
  await dialog.getByRole("button", { name: /Direction/u }).click();
  await page.getByRole("option", { name: shape.direction, exact: true }).click();
  const field = dialog.getByRole("textbox", { name: "Copies" });
  await field.fill(String(shape.copies));
  await field.blur();
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(spoken(page)).toHaveText(
    new RegExp(`Chips added in an array: ${shape.copies}`, "u"),
  );
};

const wireCount = async (page: Page): Promise<number> =>
  wiresOf(await exportedProject(page)).length;

/** Every wire in the export runs from the `clk` piece to a different Cell's `clk` pin. */
const expectClockWires = (file: ExportedFile): void => {
  const wires = wiresOf(file);
  expect(wires).toHaveLength(CELLS);
  const [clk] = instanceIds(file);
  expect(new Set(wires.map((wire) => wire.from.instanceId))).toEqual(new Set([clk]));
  expect(new Set(wires.map((wire) => wire.to.instanceId)).size).toBe(CELLS);
};

/** Right-clicks a pin: the card pins open and the chip selection stays. */
const openCard = async (page: Page, world: Point): Promise<void> => {
  const point = await at(page, world);
  await page.mouse.click(point.x, point.y, { button: "right" });
  await expect(selectOnAll(page)).toBeVisible();
};

test("sixteen clock pins are wired to one input in a single, undoable step", async ({
  isMobile,
  page,
}, testInfo) => {
  test.skip(usesTouch(isMobile, testInfo), "The touch flow below covers this with taps");
  const pointer = pointerFor(page, false);
  await importFixture(page, RAM_CELL, "RAM cell");
  await arrayOfCells(page, pointer, { direction: "Grid", copies: COPIES });
  expect(await wireCount(page)).toBe(0);

  await openCard(page, CELL_CLK);
  await selectOnAll(page).click();
  await expect(spoken(page)).toHaveText(/Pins selected: 16/u);
  await pointer.tap(await at(page, SOURCE));
  await expect(spoken(page)).toHaveText(/Wired 16 pins to clk/u);
  expectClockWires(await exportedProject(page));

  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => wireCount(page)).toBe(0);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect.poll(() => wireCount(page)).toBe(CELLS);
});

test("from the keyboard: p to the pin, a, then the source and Enter", async ({
  isMobile,
  page,
}, testInfo) => {
  test.skip(usesTouch(isMobile, testInfo), "Needs the keyboard");
  await importFixture(page, RAM_CELL, "RAM cell");
  await arrayOfCells(page, pointerFor(page, false), { direction: "Grid", copies: COPIES });

  await canvasHost(page).focus();
  await page.keyboard.press("p");
  await page.keyboard.press("p");
  await expect(spoken(page)).toHaveText(/Pin clk of Cell/u);
  await page.keyboard.press("a");
  await expect(spoken(page)).toHaveText(/Pins selected: 16/u);
  // Shift+[ walks back from the Cells to the input piece, keeping the pins picked so far.
  await expect(async () => {
    await page.keyboard.press("Shift+[");
    await expect(spoken(page)).toHaveText(/Items selected: 17/u, { timeout: 500 });
  }).toPass();
  await page.keyboard.press("p");
  await expect(spoken(page)).toHaveText(/Pin clk of clk/u);
  await page.keyboard.press("Enter");
  await expect(spoken(page)).toHaveText(/Wired 16 pins to clk/u);
  expect(await wireCount(page)).toBe(CELLS);
});

test("click order decides the bit: the outputs get bits 0 to 3 as they were picked", async ({
  isMobile,
  page,
}, testInfo) => {
  test.skip(usesTouch(isMobile, testInfo), "Shift+click needs a keyboard; touch has Pick pins");
  await importFixture(page, BIT_BUS, "Bit bus");
  for (const output of CLICK_ORDER) {
    const point = await at(page, OUTPUT_PINS[output] ?? BUS_PIN);
    await page.keyboard.down("Shift");
    await page.mouse.click(point.x, point.y);
    await page.keyboard.up("Shift");
  }
  await expect(spoken(page)).toHaveText(/Pins selected: 4/u);
  const source = await at(page, BUS_PIN);
  await page.mouse.click(source.x, source.y);
  await expect(spoken(page)).toHaveText(/Wired 4 pins to bits 0–3 of D/u);

  const file = await exportedProject(page);
  const [, ...outputs] = instanceIds(file);
  const byBit = wiresOf(file).toSorted(
    (first, second) => (first.from.bit ?? 0) - (second.from.bit ?? 0),
  );
  expect(byBit.map((wire) => wire.from.bit)).toEqual([...BITS]);
  expect(byBit.map((wire) => wire.to.instanceId)).toEqual(
    CLICK_ORDER.map((index) => outputs[index]),
  );
});

test("one illegal wire refuses all sixteen, and the notice and the live region say which", async ({
  isMobile,
  page,
}, testInfo) => {
  test.skip(usesTouch(isMobile, testInfo), "The pin card's button is reached by right-click here");
  const pointer = pointerFor(page, false);
  await importFixture(page, RAM_CELL, "RAM cell");
  // The first Cell's clk is wired by hand, before the Array, so it cannot take a second wire.
  await pointer.tap(await at(page, SOURCE));
  await pointer.tap(await at(page, CELL_CLK));
  await expect(spoken(page)).toHaveText(/Wire added/u);
  await arrayOfCells(page, pointer, { direction: "Grid", copies: COPIES });
  expect(await wireCount(page)).toBe(1);

  await openCard(page, CELL_CLK);
  await selectOnAll(page).click();
  await expect(spoken(page)).toHaveText(/Pins selected: 16/u);
  await pointer.tap(await at(page, SOURCE));
  await expect(spoken(page)).toHaveText(/clk on Cell \d+: /u);
  const words = ((await spoken(page).textContent()) ?? "").trim();
  await expect(notice(page)).toHaveText(words);
  expect(await wireCount(page)).toBe(1);
});

test("on a touch screen, Pick pins and taps wire two pins at once", async ({
  isMobile,
  page,
}, testInfo) => {
  test.skip(!usesTouch(isMobile, testInfo), "Touch projects only");
  const pointer = pointerFor(page, true);
  await importFixture(page, RAM_CELL, "RAM cell");
  await arrayOfCells(page, pointer, { direction: "Column", copies: 1 });

  const pick = bar(page).getByRole("button", { name: "Pick pins" });
  await pick.tap();
  await expect(pick).toHaveAttribute("aria-pressed", "true");
  await pointer.tap(await at(page, CELL_CLK));
  await pointer.tap(await at(page, { x: CELL_CLK.x, y: CELL_CLK.y + NEXT_ROW }));
  await expect(spoken(page)).toHaveText(/Pins selected: 2/u);
  await pick.tap();
  await expect(pick).toHaveAttribute("aria-pressed", "false");
  await pointer.tap(await at(page, SOURCE));
  await expect(spoken(page)).toHaveText(/Wired 2 pins to clk/u);
  expect(await wireCount(page)).toBe(TWO);
});
