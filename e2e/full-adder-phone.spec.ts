/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Locator, Page } from "@playwright/test";

import {
  chipIndex,
  fullAdderWires,
  halfAdderBoard,
  halfAdderWires,
  nandPins,
  offset,
  OUTPUT_PIN,
  placed,
  wireByTaps,
} from "./adder-support";
import { libraryRow, libraryToggle, placingBanner, tapOpenLibrary } from "./library-support";
import { addPins, closePins, nameField, nameRow, openPins, rowNames, tap } from "./pins-support";
import type { Direction } from "./pins-support";
import {
  chipPath,
  chooseFolder,
  makeFolder,
  outcome,
  saveButton,
  tapNewChip,
  unsavedDot,
} from "./save-support";
import { createProject, expect, exportedProject, test, touch, worldToPage } from "./support";
import type { ExportedWire, Point } from "./support";
import { middleOf, pointerFor } from "./wiring-support";
import type { Pointer } from "./wiring-support";

/*
 * The Done-when journey (spec §1, D13) on a phone, with taps alone (and one long-press for the
 * chip menu); only names are typed. Folders, a half adder filed at its first save, a full adder
 * made of two of them and an OR of three NANDs, its whole truth table, then a change inside the
 * half adder that the full adder runs at once.
 */

const PHONES = new Set(["mobile-chrome", "mobile-safari"]);
const HALF_ADDER_NANDS = 6;
const OR_NANDS = 3;
/** Past `LONG_PRESS_MS` (500 ms) in `domain/gestures.ts`. */
const LONG_PRESS_MS = 700;
/** Longer than the 200 ms the URL waits before it takes the camera. */
const SETTLE_MS = 500;
/** Where the two half adders' centres go: below the full adder's row of NANDs, side by side. */
const HALF_ADDER_SPOTS: readonly Point[] = [
  { x: 160, y: 320 },
  { x: 480, y: 320 },
];
/** The middle of a Half adder's body. */
const HALF_ADDER_MIDDLE = { x: 100, y: 40 };

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(!PHONES.has(testInfo.project.name), "The journey runs on the phone projects");
  // Two chips built wire by wire, then a truth table of eight rows.
  test.slow();
});

/** Adds 1-bit pins of one direction in the Pins sheet, naming them in order. */
const addNamedPins = async (
  pins: Locator,
  direction: Direction,
  names: readonly string[],
): Promise<void> => {
  await addPins(pins, { direction, count: names.length }, tap);
  // The new rows take focus once the dialog has closed; naming before that races it.
  await expect(nameField(pins, direction, 1)).toBeFocused();
  for (const [index, name] of names.entries()) {
    await nameRow(nameField(pins, direction, index + 1), name);
  }
  await expect.poll(() => rowNames(pins, direction)).toEqual(names);
};

const addChipPins = async (
  page: Page,
  { inputs, outputs }: { readonly inputs: readonly string[]; readonly outputs: readonly string[] },
): Promise<void> => {
  const pins = await openPins(page, tap);
  await addNamedPins(pins, "input", inputs);
  await addNamedPins(pins, "output", outputs);
  await closePins(page, tap);
};

const addNands = async (page: Page, count: number): Promise<void> => {
  for (let added = 0; added < count; added += 1) {
    await tap(page.getByRole("button", { name: "Add NAND" }));
  }
};

/** Fits the board on the phone's canvas, so every pin can be tapped. */
const fit = async (page: Page): Promise<void> => {
  await tap(page.getByRole("button", { name: "Fit" }));
  // Fit may leave the camera as it was, so wait for two URL reads half a second apart to agree.
  // The URL takes the camera 200 ms after it stops moving (view-sync).
  let previous: string | undefined = undefined;
  await expect
    .poll(
      () => {
        const now = page.url();
        const still = now === previous;
        previous = now;
        return still;
      },
      { intervals: [SETTLE_MS] },
    )
    .toBe(true);
};

/** Step 2: Half adder, wired with taps and filed into Arithmetic › Adders at its first save. */
const buildHalfAdder = async (page: Page, pointer: Pointer): Promise<void> => {
  await tapNewChip(page, "Half adder");
  await addChipPins(page, { inputs: ["A", "B"], outputs: ["SUM", "CARRY"] });
  await addNands(page, HALF_ADDER_NANDS);
  const file = await exportedProject(page);
  const board = halfAdderBoard(file, chipIndex(file, "Half adder"));
  expect(board.nands).toHaveLength(HALF_ADDER_NANDS);
  await fit(page);
  await wireByTaps(page, pointer, halfAdderWires(board));

  await tap(saveButton(page));
  const dialog = page.getByRole("dialog", { name: "Save Half adder" });
  await chooseFolder(dialog, "Arithmetic › Adders", tap);
  await tap(dialog.getByRole("button", { name: "Save", exact: true }));
  await expect(dialog).toHaveCount(0);
  await expect(outcome(page, "Saved Half adder")).toBeAttached();
};

/** Opens Arithmetic and Adders in the sheet, arms Half adder and taps two copies onto the canvas. */
const placeHalfAdders = async (page: Page, pointer: Pointer): Promise<void> => {
  const tree = await tapOpenLibrary(page);
  for (const folder of ["Arithmetic", "Adders"]) {
    const row = libraryRow(tree, folder);
    if ((await row.getAttribute("aria-expanded")) !== "true") {
      await tap(row);
    }
  }
  await tap(libraryRow(tree, "Half adder"));
  await expect(libraryToggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(placingBanner(page, "Half adder")).toBeVisible();
  for (const spot of HALF_ADDER_SPOTS) {
    await pointer.tap(await worldToPage(page, spot));
  }
  await tap(page.getByRole("button", { name: "Done", exact: true }));
  await expect(placingBanner(page, "Half adder")).toHaveCount(0);
};

/** Step 3: Full adder from two Half adders and an OR, wired with taps and saved. */
const buildFullAdder = async (page: Page, pointer: Pointer): Promise<void> => {
  await tapNewChip(page, "Full adder");
  await addChipPins(page, { inputs: ["A", "B", "CIN"], outputs: ["S", "COUT"] });
  await addNands(page, OR_NANDS);
  await fit(page);
  await placeHalfAdders(page, pointer);
  await fit(page);
  await wireByTaps(page, pointer, fullAdderWires(await exportedProject(page)));

  await tap(saveButton(page));
  const dialog = page.getByRole("dialog", { name: "Save Full adder" });
  await tap(dialog.getByRole("button", { name: "Save", exact: true }));
  await expect(dialog).toHaveCount(0);
  await expect(outcome(page, "Saved Full adder")).toBeAttached();
};

/** Sets a full adder input by tapping its switch in the summary when it disagrees. */
const setInput = async (page: Page, name: string, on: boolean): Promise<void> => {
  const control = page.getByRole("switch", { name: `Input ${name}`, exact: true });
  if ((await control.isChecked()) !== on) {
    await tap(page.locator("label").filter({ has: control }));
  }
  await expect(control).toBeChecked({ checked: on });
};

const outputOf = (page: Page, name: string): Locator =>
  page.getByText(new RegExp(`^Output ${name}: `, "u"));

const bit = (on: boolean): string => String(Number(on));
/** Two ones make a carry; an odd count of ones makes the sum 1. */
const PAIR = 2;

const ROWS = [false, true].flatMap((a) =>
  [false, true].flatMap((b) => [false, true].map((cin) => [a, b, cin] as const)),
);

/** Step 4: every row of the truth table: S is A xor B xor CIN, COUT the majority. */
const checkTruthTable = async (page: Page): Promise<void> => {
  for (const [a, b, cin] of ROWS) {
    await setInput(page, "A", a);
    await setInput(page, "B", b);
    await setInput(page, "CIN", cin);
    const ones = [a, b, cin].filter(Boolean).length;
    await expect(outputOf(page, "S")).toHaveText(`Output S: ${bit(ones % PAIR === 1)}`);
    await expect(outputOf(page, "COUT")).toHaveText(`Output COUT: ${bit(ones >= PAIR)}`);
  }
};

/** Step 5: a long-press on the first Half adder opens its menu, and Look inside opens it. */
const lookInsideFirstHalfAdder = async (page: Page): Promise<void> => {
  const file = await exportedProject(page);
  const parts = file.project.chips[chipIndex(file, "Full adder")]?.draft.instances ?? [];
  const first = placed(parts.find((part) => part.kind.type === "custom")?.position);
  const at = await worldToPage(page, offset(first, HALF_ADDER_MIDDLE));
  await touch(page, [
    { type: "down", id: 1, at },
    { type: "wait", ms: LONG_PRESS_MS },
    { type: "up", id: 1, at },
  ]);
  await tap(page.getByRole("menuitem", { name: "Look inside" }));
  await expect(chipPath(page).getByRole("listitem")).toHaveText(["Full adder", "Half adder"]);
};

/** A wire by the input it drives: each input takes one wire. */
const intoKey = (wire: ExportedWire): string => `${wire.to.instanceId}:${String(wire.to.pin)}`;

/** Step 5: selects the wire into CARRY with a tap on its longest run, and deletes it. */
const deleteCarryWire = async (page: Page, pointer: Pointer): Promise<void> => {
  await fit(page);
  const file = await exportedProject(page);
  const chip = chipIndex(file, "Half adder");
  const draft = file.project.chips[chip]?.draft;
  const board = halfAdderBoard(file, chip);
  const carryPin = draft?.pins.find((pin) => pin.name === "CARRY")?.id;
  const into = draft?.instances.find((part) => part.kind.pinId === carryPin)?.id;
  const wire = draft?.wires.find((item) => item.to.instanceId === into);
  if (wire === undefined) {
    throw new Error("Half adder has no wire into CARRY");
  }
  const from = nandPins(board.nands.at(-1)).out;
  const polyline = [from, ...wire.waypoints, offset(board.carry, OUTPUT_PIN)];
  await pointer.tap(await worldToPage(page, middleOf(polyline)));
  await tap(page.getByRole("button", { name: "Delete", exact: true }));
  await expect
    .poll(async () => {
      const after = await exportedProject(page);
      return after.project.chips[chipIndex(after, "Half adder")]?.draft.wires.map((item) =>
        intoKey(item),
      );
    })
    .toEqual(draft?.wires.filter((item) => item !== wire).map((item) => intoKey(item)));
};

test("a full adder built from two half adders with taps, then changed inside", async ({ page }) => {
  const pointer = pointerFor(page, true);
  await createProject(page);

  // Step 1: the folders, from the library sheet.
  await tapOpenLibrary(page);
  await makeFolder(page, { name: "Arithmetic" }, tap);
  await makeFolder(page, { name: "Adders", inside: "Arithmetic" }, tap);

  await buildHalfAdder(page, pointer);
  await buildFullAdder(page, pointer);
  await checkTruthTable(page);

  await lookInsideFirstHalfAdder(page);
  await deleteCarryWire(page, pointer);
  // No pin changed, so the save asks nothing.
  await tap(saveButton(page));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(outcome(page, "Saved Half adder")).toBeAttached();

  /*
   * Step 6: back in Full adder, which already runs the new Half adder. Its CARRY is driven by
   * nothing now, so the circuit can't be simulated, and for A = B = 1 COUT is no longer 1.
   */
  await tap(chipPath(page).getByRole("button", { name: "Full adder" }));
  await expect(chipPath(page).getByRole("listitem")).toHaveText(["Full adder"]);
  await setInput(page, "A", true);
  await setInput(page, "B", true);
  await setInput(page, "CIN", false);
  await expect(outputOf(page, "COUT")).toHaveText("Output COUT: unknown");
  await expect(
    page.getByText(/has an unconnected input, so the circuit cannot be simulated/u),
  ).toBeVisible();

  // Step 7 (Review Focus 1): the half adder's save re-routed Full adder but changed nothing there.
  await expect(unsavedDot(page)).toHaveCount(0);
  await expect(saveButton(page)).toBeDisabled();
});
