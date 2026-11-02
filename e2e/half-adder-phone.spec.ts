/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Page } from "@playwright/test";

import {
  addPins,
  closePins,
  nameField,
  nameRow,
  openPins,
  piecePosition,
  tap,
} from "./pins-support";
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
import type { ExportedFile, Point } from "./support";
import { pointerFor, wiresOf } from "./wiring-support";
import type { Pointer } from "./wiring-support";

/*
 * A half adder built on a phone with taps alone: the toolbar's and the sheet's buttons are tapped,
 * the canvas is tapped, and only the pin names are typed.
 */

const PHONES = new Set(["mobile-chrome", "mobile-safari"]);
const NANDS = 6;
const TWO = 2;
/** Where wires attach, relative to a part's position (`placeSide` in `domain/chip-layout.ts`). */
const NAND_PIN = { a: { x: 0, y: 20 }, b: { x: 0, y: 60 }, out: { x: 120, y: 40 } } as const;
/** The NANDs in the order they were added (and exported). */
const NAND_ORDER = { n1: 0, n2: 1, n3: 2, n4: 3, n5: 4, n6: 5 } as const;
const INPUT_PIN = { x: 40, y: 20 };
const OUTPUT_PIN = { x: 0, y: 20 };
/** The middle of a 1-bit pin piece. */
const PIECE_MIDDLE = { x: 20, y: 20 };

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(!PHONES.has(testInfo.project.name), "The phone flow runs on the phone projects");
});

const offset = (at: Point, by: Point): Point => ({ x: at.x + by.x, y: at.y + by.y });

/** Deletes the demo's NAND: a tap selects it and the toolbar's Delete removes it. */
const deleteNand = async (page: Page, pointer: Pointer): Promise<void> => {
  await pointer.tap(await chipCenter(page, DEMO_PART.nand));
  await expect(spoken(page)).toHaveText(/NAND gate 1 selected/u);
  await tap(page.getByRole("button", { name: "Delete", exact: true }));
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

interface Board {
  readonly a: Point;
  readonly b: Point;
  readonly sum: Point;
  readonly carry: Point;
  readonly nands: readonly Point[];
}

const placed = (point: Point | undefined): Point => {
  if (point === undefined) {
    throw new Error("A part is missing from the export");
  }
  return point;
};

/** Where every part landed, read from the exported file. */
const boardOf = (file: ExportedFile): Board => ({
  a: placed(piecePosition(file, "A")),
  b: placed(piecePosition(file, "B")),
  sum: placed(piecePosition(file, "SUM")),
  carry: placed(piecePosition(file, "CARRY")),
  nands: (file.project.chips[0]?.draft.instances ?? [])
    .filter((item) => item.kind.type === "nand")
    .map((item) => item.position),
});

/** Every wire as world points: from an output pin to an input pin. */
const halfAdderWires = (board: Board): readonly (readonly [Point, Point])[] => {
  const nand = (index: number) => {
    const at = placed(board.nands[index]);
    return {
      a: offset(at, NAND_PIN.a),
      b: offset(at, NAND_PIN.b),
      out: offset(at, NAND_PIN.out),
    };
  };
  const [n1, n2, n3, n4, n5, n6] = [
    nand(NAND_ORDER.n1),
    nand(NAND_ORDER.n2),
    nand(NAND_ORDER.n3),
    nand(NAND_ORDER.n4),
    nand(NAND_ORDER.n5),
    nand(NAND_ORDER.n6),
  ];
  const a = offset(board.a, INPUT_PIN);
  const b = offset(board.b, INPUT_PIN);
  return [
    // XOR: n4 = NAND(NAND(A, n1), NAND(B, n1)) with n1 = NAND(A, B).
    [a, n1.a],
    [b, n1.b],
    [a, n2.a],
    [n1.out, n2.b],
    [b, n3.a],
    [n1.out, n3.b],
    [n2.out, n4.a],
    [n3.out, n4.b],
    [n4.out, offset(board.sum, OUTPUT_PIN)],
    // AND: n6 = NOT(NAND(A, B)), the NOT a NAND with both inputs tied.
    [a, n5.a],
    [b, n5.b],
    [n5.out, n6.a],
    [n5.out, n6.b],
    [n6.out, offset(board.carry, OUTPUT_PIN)],
  ];
};

/** Tap-tap wiring: the first tap arms a pin, the second connects it. */
const wireUp = async (page: Page, pointer: Pointer, board: Board): Promise<number> => {
  const wires = halfAdderWires(board);
  for (const [from, to] of wires) {
    await pointer.tap(await worldToPage(page, from));
    await expect(spoken(page)).toHaveText(/ready to wire/u);
    await pointer.tap(await worldToPage(page, to));
    await expect(spoken(page)).toHaveText(/Wire added/u);
  }
  return wires.length;
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
  const board = boardOf(await exportedProject(page));
  expect(board.nands).toHaveLength(NANDS);

  // Fit the whole board on the phone's canvas, so every pin can be tapped.
  const before = urlCamera(page).zoom;
  await tap(page.getByRole("button", { name: "Fit" }));
  await expect.poll(() => urlCamera(page).zoom).not.toBe(before);

  const count = await wireUp(page, pointer, board);
  expect(wiresOf(await exportedProject(page))).toHaveLength(count);
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
