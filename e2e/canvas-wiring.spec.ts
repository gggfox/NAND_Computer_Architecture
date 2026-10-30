/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Page } from "@playwright/test";

import {
  canvasHost,
  createProject,
  DEMO_PART,
  expect,
  exportedProject,
  output,
  pinPoint,
  setInputs,
  spoken,
  test,
  worldToPage,
} from "./support";
import type { Point } from "./support";
import {
  DEMO_WIRES,
  deleteDemoWire,
  importBus,
  inputBWire,
  instanceIds,
  isOrthogonal,
  NAND_B,
  pointerFor,
  polylineOf,
  press,
  tabToCanvas,
  usesTouch,
  wiresOf,
} from "./wiring-support";
import type { Pointer } from "./wiring-support";

const NAND_OUT = 2;
/** The NAND's world rect, and the one cell (`PIN_CELL`) a route keeps clear around it. */
const NAND_RECT = { x: 160, y: 40, width: 120, height: 80 };
const PIN_CELL = 20;
/** In `bus.json`: the 4-bit input D's pin, and the NAND's `a` (the NAND sits where the demo's does). */
const BUS_PIN: Point = { x: 40, y: 80 };
const BUS_NAND_A: Point = { x: 160, y: 60 };
const PICKED_BIT = 2;
/** `]` from nothing: Input A, Input B, the NAND, the output, then a NAND added from the toolbar. */
const STEPS_TO_INPUT_B = 2;
const STEPS_INPUT_B_TO_NAND_2 = 3;
/** `p` from no card: the NAND's a, then b. */
const STEPS_TO_PIN_B = 2;

/** The new wire is in the export, routed orthogonally, and the NAND now reads it. */
const expectInputBWired = async (page: Page): Promise<void> => {
  const file = await exportedProject(page);
  const wire = inputBWire(file);
  expect(wire).toBeDefined();
  if (wire !== undefined) {
    expect(isOrthogonal(polylineOf(file, wire))).toBe(true);
  }
  await setInputs(page, true, true);
  await expect(output(page)).toHaveText("Output: 0");
  await setInputs(page, true, false);
  await expect(output(page)).toHaveText("Output: 1");
};

const expectUndoRemovesIt = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Undo" }).click();
  const file = await exportedProject(page);
  expect(inputBWire(file)).toBeUndefined();
  expect(wiresOf(file)).toHaveLength(DEMO_WIRES - 1);
};

test("tapping input B's pin, then the NAND's b, wires them; Undo removes the wire", async ({
  isMobile,
  page,
}, testInfo) => {
  const pointer = pointerFor(page, usesTouch(isMobile, testInfo));
  await createProject(page);
  await deleteDemoWire(page, pointer, { part: DEMO_PART.nand, pin: NAND_B });

  await pointer.tap(await pinPoint(page, DEMO_PART.inputB, 0));
  await expect(spoken(page)).toHaveText(/B of B ready to wire/u);
  await pointer.tap(await pinPoint(page, DEMO_PART.nand, NAND_B));
  await expect(spoken(page)).toHaveText(/Wire added/u);

  await expectInputBWired(page);
  await expectUndoRemovesIt(page);
});

test("dragging from input B's pin to the NAND's b wires them; Undo removes the wire", async ({
  isMobile,
  page,
}, testInfo) => {
  const pointer = pointerFor(page, usesTouch(isMobile, testInfo));
  await createProject(page);
  await deleteDemoWire(page, pointer, { part: DEMO_PART.nand, pin: NAND_B });

  const from = await pinPoint(page, DEMO_PART.inputB, 0);
  const to = await pinPoint(page, DEMO_PART.nand, NAND_B);
  await pointer.drag(from, to);
  await expect(spoken(page)).toHaveText(/Wire added/u);

  await expectInputBWired(page);
  await expectUndoRemovesIt(page);
});

/** Whether a segment meets the open inside of `rect` grown by one cell on every side. */
const entersGrown = (from: Point, to: Point): boolean =>
  Math.min(from.x, to.x) < NAND_RECT.x + NAND_RECT.width + PIN_CELL &&
  Math.max(from.x, to.x) > NAND_RECT.x - PIN_CELL &&
  Math.min(from.y, to.y) < NAND_RECT.y + NAND_RECT.height + PIN_CELL &&
  Math.max(from.y, to.y) > NAND_RECT.y - PIN_CELL;

test("a feedback wire from the NAND's out to its a routes around the NAND", async ({
  isMobile,
  page,
}, testInfo) => {
  const pointer = pointerFor(page, usesTouch(isMobile, testInfo));
  await createProject(page);
  await deleteDemoWire(page, pointer, { part: DEMO_PART.nand, pin: 0 });

  await pointer.tap(await pinPoint(page, DEMO_PART.nand, NAND_OUT));
  await pointer.tap(await pinPoint(page, DEMO_PART.nand, 0));
  await expect(spoken(page)).toHaveText(/Wire added/u);

  const file = await exportedProject(page);
  const nand = instanceIds(file)[DEMO_PART.nand];
  const loop = wiresOf(file).find(
    (item) => item.from.instanceId === nand && item.to.instanceId === nand,
  );
  expect(loop).toBeDefined();
  const waypoints = loop?.waypoints ?? [];
  // Past the one-cell stub at each pin, no segment comes within a cell of the NAND.
  expect(waypoints.length).toBeGreaterThan(1);
  const inside = waypoints.slice(1).filter((to, index) => {
    const from = waypoints[index];
    return from !== undefined && entersGrown(from, to);
  });
  expect(inside).toEqual([]);
});

/** Arms the bus fixture's NAND `a`, then taps the 4-bit input D: the bit picker opens. */
const openBitPicker = async (page: Page, pointer: Pointer): Promise<void> => {
  await importBus(page);
  await pointer.tap(await worldToPage(page, BUS_NAND_A));
  await expect(spoken(page)).toHaveText(/a of NAND gate 1 ready to wire/u);
  await pointer.tap(await worldToPage(page, BUS_PIN));
  await expect(page.getByRole("menu", { name: "Pick a bit" })).toBeVisible();
};

test("wiring a 1-bit pin to a 4-bit bus asks for the bit, and the bus end keeps it", async ({
  isMobile,
  page,
}, testInfo) => {
  await createProject(page);
  await openBitPicker(page, pointerFor(page, usesTouch(isMobile, testInfo)));
  const entries = page.getByRole("menu", { name: "Pick a bit" }).getByRole("menuitem");
  await expect(entries).toHaveText(["d0", "d1", "d2", "d3"]);
  await page.getByRole("menuitem", { name: "d2" }).click();
  await expect(spoken(page)).toHaveText(/Wire added/u);

  const file = await exportedProject(page);
  const [bus] = instanceIds(file);
  const [wire] = wiresOf(file);
  const busEnd = wire?.from.instanceId === bus ? wire?.from : wire?.to;
  expect(busEnd).toEqual({ instanceId: bus, pin: 0, bit: PICKED_BIT });
});

test("from the keyboard, w arms input B's pin, Enter wires it to a new NAND's b, and Escape cancels", async ({
  page,
}) => {
  await createProject(page);
  await page.getByRole("button", { name: "Add NAND" }).click();
  await expect(page.getByText("NAND gate 2", { exact: true })).toBeVisible();
  await tabToCanvas(page);
  await press(page, "]", STEPS_TO_INPUT_B);
  await expect(spoken(page)).toHaveText(/^B selected\s*$/u);
  await page.keyboard.press("p");
  await page.keyboard.press("w");
  await expect(spoken(page)).toHaveText(/B of B ready to wire/u);
  await press(page, "]", STEPS_INPUT_B_TO_NAND_2);
  await expect(spoken(page)).toHaveText(/NAND gate 2 selected/u);
  await press(page, "p", STEPS_TO_PIN_B);
  await expect(spoken(page)).toHaveText(/Pin b of NAND gate 2/u);
  await page.keyboard.press("Enter");
  await expect(spoken(page)).toHaveText(/Wire added/u);

  const file = await exportedProject(page);
  const ids = instanceIds(file);
  const nand2 = ids.at(-1);
  expect(
    wiresOf(file).some(
      (item) =>
        item.from.instanceId === ids[DEMO_PART.inputB] &&
        item.to.instanceId === nand2 &&
        item.to.pin === NAND_B,
    ),
  ).toBe(true);

  await canvasHost(page).focus();
  await page.keyboard.press("w");
  await expect(spoken(page)).toHaveText(/ready to wire/u);
  await page.keyboard.press("Escape");
  await expect(spoken(page)).toHaveText(/Wiring cancelled/u);
});
