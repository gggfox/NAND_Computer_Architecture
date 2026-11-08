import type { Locator, Page } from "@playwright/test";

import { buildHalfAdder, fullAdderNamedWires } from "./keyboard-adders";
import {
  addChipPins,
  closeLibrarySheet,
  makeFolderByKeyboard,
  newChipByKeyboard,
  placeFromLibrary,
  renameChipInLibrary,
  saveOpenChip,
} from "./keyboard-chips";
import {
  activate,
  addPart,
  chooseEntry,
  createProjectByKeyboard,
  deleteWireInto,
  exportedWireCount,
  setSwitchByKey,
  skipToStructure,
  structureRegion,
  wireByNames,
} from "./keyboard-support";
import { chipPath, outcome, saveButton, unsavedDot } from "./save-support";
import { expect, test } from "./support";

/*
 * A full adder built, checked and changed with the keyboard alone (phase 6, spec 3.2). The
 * journey is the same as `full-adder-phone.spec.ts`: folders, a Half adder filed at its first
 * save, a Full adder made of two Half adders and an OR of three NANDs, its whole truth table,
 * then a change inside the Half adder that the Full adder runs at once. No pointer, no tap, no
 * canvas coordinates. Wires are made in "Wire to…" by part and pin names.
 */

const OR_NANDS = 3;
const HALF_ADDERS = 2;
const HALF_ADDER_WIRES = 14;
const FULL_ADDER_WIRES = 12;
const ADDERS_FOLDER = "Arithmetic › Adders";

test.beforeEach(() => {
  // Two chips built wire by wire, then a truth table of eight rows.
  test.slow();
});

/** Step 2: the Half adder from the keyboard half adder build, filed into Arithmetic › Adders. */
const buildAndFileHalfAdder = async (page: Page): Promise<void> => {
  await skipToStructure(page);
  await buildHalfAdder(page);
  expect(await exportedWireCount(page, "NAND demo")).toBe(HALF_ADDER_WIRES);
  await renameChipInLibrary(page, "NAND demo", "Half adder");
  await expect(chipPath(page).locator('[aria-current="page"]')).toHaveText("Half adder");
  await saveOpenChip(page, "Half adder", ADDERS_FOLDER);
  await expect(unsavedDot(page)).toHaveCount(0);
};

/** Step 3: Full adder from two Half adders and an OR, wired by names and saved. */
const buildFullAdder = async (page: Page): Promise<void> => {
  await newChipByKeyboard(page, "Full adder");
  await addChipPins(page, { inputs: ["A", "B", "CIN"], outputs: ["S", "COUT"] });
  const nands: string[] = [];
  for (let added = 0; added < OR_NANDS; added += 1) {
    nands.push(await addPart(page, "NAND"));
  }
  const halfAdders = await placeFromLibrary(page, {
    folders: ["Arithmetic", "Adders"],
    chip: "Half adder",
    count: HALF_ADDERS,
  });
  expect(halfAdders).toHaveLength(HALF_ADDERS);
  for (const wire of fullAdderNamedWires(halfAdders.toSorted(), nands)) {
    await wireByNames(page, wire);
  }
  expect(await exportedWireCount(page, "Full adder")).toBe(FULL_ADDER_WIRES);
  await saveOpenChip(page, "Full adder");
};

const outputOf = (page: Page, name: string): Locator =>
  page.getByText(new RegExp(`^Output ${name}: `, "u"));

const bit = (on: boolean): string => String(Number(on));
/** Two ones make a carry. An odd count of ones makes the sum 1. */
const PAIR = 2;

const ROWS = [false, true].flatMap((a) =>
  [false, true].flatMap((b) => [false, true].map((cin) => [a, b, cin] as const)),
);

/** Step 4: every row of the truth table. S is A xor B xor CIN, and COUT is the majority. */
const checkTruthTable = async (page: Page): Promise<void> => {
  for (const [a, b, cin] of ROWS) {
    await setSwitchByKey(page, "A", a);
    await setSwitchByKey(page, "B", b);
    await setSwitchByKey(page, "CIN", cin);
    const ones = [a, b, cin].filter(Boolean).length;
    await expect(outputOf(page, "S")).toHaveText(`Output S: ${bit(ones % PAIR === 1)}`);
    await expect(outputOf(page, "COUT")).toHaveText(`Output COUT: ${bit(ones >= PAIR)}`);
  }
};

/**
 * Step 5: Look inside the first Half adder from its part menu, delete the wire into CARRY from
 * its wire menu, and save. No pin changed, so the save asks nothing.
 */
const changeInsideHalfAdder = async (page: Page): Promise<void> => {
  await chooseEntry(
    page,
    structureRegion(page).getByRole("button", { name: "Actions for Half adder 1", exact: true }),
    "Look inside",
  );
  await expect(chipPath(page).getByRole("listitem")).toHaveText(["Full adder", "Half adder"]);
  await deleteWireInto(page, { part: "Output CARRY", pin: "CARRY" });
  expect(await exportedWireCount(page, "Half adder")).toBe(HALF_ADDER_WIRES - 1);
  await activate(saveButton(page));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(outcome(page, "Saved Half adder")).toBeAttached();
};

test("a full adder with the keyboard: two half adders, truth table, then a change inside", async ({
  page,
}) => {
  await createProjectByKeyboard(page);

  // Step 1: the folders, from the library.
  await makeFolderByKeyboard(page, { name: "Arithmetic" });
  await makeFolderByKeyboard(page, { name: "Adders", inside: "Arithmetic" });
  await closeLibrarySheet(page);

  await buildAndFileHalfAdder(page);
  await buildFullAdder(page);
  await checkTruthTable(page);
  await changeInsideHalfAdder(page);

  /*
   * Step 6: back in Full adder, which already runs the new Half adder. Nothing drives its CARRY
   * now, so the circuit cannot be simulated, and for A = B = 1 COUT is not 1 any more.
   */
  await activate(chipPath(page).getByRole("button", { name: "Full adder" }));
  await expect(chipPath(page).getByRole("listitem")).toHaveText(["Full adder"]);
  await setSwitchByKey(page, "A", true);
  await setSwitchByKey(page, "B", true);
  await setSwitchByKey(page, "CIN", false);
  await expect(outputOf(page, "COUT")).toHaveText("Output COUT: unknown");
  await expect(
    page.getByText(/has an unconnected input, so the circuit cannot be simulated/u),
  ).toBeVisible();

  // Step 7: the Half adder's save changed nothing in Full adder.
  await expect(unsavedDot(page)).toHaveCount(0);
  await expect(saveButton(page)).toBeDisabled();
});
