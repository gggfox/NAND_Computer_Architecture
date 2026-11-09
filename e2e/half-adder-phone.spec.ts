/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Page } from "@playwright/test";

import { halfAdderBoard, halfAdderWires, offset, wireByTaps } from "./adder-support";
import { addPins, closePins, nameField, nameRow, openPins, tap } from "./pins-support";
import {
  chipCenter,
  createProject,
  DEMO_PART,
  expect,
  exportedProject,
  inputSwitch,
  spoken,
  test,
  urlCamera,
  worldToPage,
} from "./support";
import type { Point } from "./support";
import { pressZoomTool } from "./toolbar-support";
import { pointerFor, wiresOf } from "./wiring-support";
import type { Pointer } from "./wiring-support";

/*
 * A half adder built on a phone with taps alone: the toolbar's and the sheet's buttons are tapped,
 * the canvas is tapped, and only the pin names are typed.
 */

const PHONES = new Set(["mobile-chrome", "mobile-safari"]);
const NANDS = 6;
const TWO = 2;
/** The middle of a 1-bit pin piece. */
const PIECE_MIDDLE = { x: 20, y: 20 };

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(!PHONES.has(testInfo.project.name), "The phone flow runs on the phone projects");
});

/** Deletes the demo's NAND: a tap selects it and the toolbar's Delete removes it. */
const deleteNand = async (page: Page, pointer: Pointer): Promise<void> => {
  await pointer.tap(await chipCenter(page, DEMO_PART.nand));
  await expect(spoken(page)).toHaveText(/NAND gate 1 selected/u);
  await tap(
    page
      .getByRole("toolbar", { name: "Editor tools" })
      .getByRole("button", { name: "Delete", exact: true }),
  );
  await expect(page.getByText("NAND gate 1", { exact: true })).toHaveCount(0);
};

/** In the Pins sheet: deletes OUT from its row's menu, then adds SUM and CARRY, typing only names. */
const replaceOutputs = async (page: Page): Promise<void> => {
  const pins = await openPins(page, tap);
  await tap(pins.getByRole("button", { name: "Actions for OUT" }));
  await tap(page.getByRole("menuitem", { name: "Delete" }));
  await expect(pins.getByRole("grid", { name: "Outputs" })).toHaveCount(0);
  await addPins(pins, { direction: "output", count: TWO }, tap);
  await expect(nameField(pins, "output", 1)).toBeFocused();
  await nameRow(nameField(pins, "output", 1), "SUM");
  await nameRow(nameField(pins, "output", TWO), "CARRY");
  await expect(pins.getByRole("row", { name: "CARRY" })).toBeVisible();
  await closePins(page, tap);
};

/** Sets an input by tapping its piece on the canvas when the summary switch disagrees. */
const setByTap = async (
  page: Page,
  pointer: Pointer,
  { name, at, on }: { readonly name: "A" | "B"; readonly at: Point; readonly on: boolean },
): Promise<void> => {
  const control = inputSwitch(page, `Input ${name}`);
  if ((await control.isChecked()) !== on) {
    await pointer.tap(await worldToPage(page, offset(at, PIECE_MIDDLE)));
  }
  await expect(control).toBeChecked({ checked: on });
};

/**
 * Out to the project list and back in, by taps, so the editor opens at zoom 1. Fitted on a phone,
 * the board is at the 0.25 minimum, where a pin's 24 px target covers its input's whole body and a
 * tap arms the pin instead of toggling the input.
 */
const reopenAtFullSize = async (page: Page): Promise<void> => {
  await tap(page.getByRole("link", { name: "All projects" }));
  await tap(page.getByRole("link", { name: "NAND demo" }));
  await expect(page.getByText(/^Output SUM: /u)).toBeAttached();
  expect(urlCamera(page).zoom).toBe(1);
};

const COMBINATIONS = [
  [false, false],
  [false, true],
  [true, false],
  [true, true],
] as const;

test("a half adder built with taps adds every pair of bits", async ({ page }) => {
  const pointer = pointerFor(page, true);
  await createProject(page);
  await deleteNand(page, pointer);
  await replaceOutputs(page);
  for (let added = 0; added < NANDS; added += 1) {
    await tap(page.getByRole("button", { name: "Add NAND" }));
  }
  const board = halfAdderBoard(await exportedProject(page));
  expect(board.nands).toHaveLength(NANDS);

  // Fit the whole board on the phone's canvas, so every pin can be tapped.
  const before = urlCamera(page).zoom;
  await pressZoomTool(page, "Fit", tap);
  await expect.poll(() => urlCamera(page).zoom).not.toBe(before);

  const wires = halfAdderWires(board);
  await wireByTaps(page, pointer, wires);
  expect(wiresOf(await exportedProject(page))).toHaveLength(wires.length);
  await reopenAtFullSize(page);

  for (const [a, b] of COMBINATIONS) {
    await setByTap(page, pointer, { name: "A", at: board.a, on: a });
    await setByTap(page, pointer, { name: "B", at: board.b, on: b });
    await expect(page.getByText(/^Output SUM: /u)).toHaveText(
      `Output SUM: ${String(Number(a !== b))}`,
    );
    await expect(page.getByText(/^Output CARRY: /u)).toHaveText(
      `Output CARRY: ${String(Number(a && b))}`,
    );
  }
});
