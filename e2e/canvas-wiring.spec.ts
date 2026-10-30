/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Page } from "@playwright/test";

import {
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
  const [bus, nand] = instanceIds(file);
  const wires = wiresOf(file);
  expect(wires).toHaveLength(1);
  const [wire] = wires;
  const busFirst = wire?.from.instanceId === bus;
  const busEnd = busFirst ? wire?.from : wire?.to;
  const nandEnd = busFirst ? wire?.to : wire?.from;
  expect(busEnd).toEqual({ instanceId: bus, pin: 0, bit: PICKED_BIT });
  // The 1-bit end takes no bit.
  expect(nandEnd).toEqual({ instanceId: nand, pin: 0 });
});
