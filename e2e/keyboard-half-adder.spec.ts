import {
  addPart,
  chooseEntry,
  createProjectByKeyboard,
  exportedWireCount,
  halfAdderNamedWires,
  renameChipInLibrary,
  replaceOutputs,
  saveOpenChip,
  setSwitchByKey,
  skipToStructure,
  structureRegion,
  wireByNames,
} from "./keyboard-support";
import { chipPath, unsavedDot } from "./save-support";
import { expect, test } from "./support";

/*
 * A half adder built, checked and saved with the keyboard alone (phase 6, spec 3.2). No pointer,
 * no tap, no canvas coordinates. Wires are made in "Wire to…" by part and pin names.
 */

const NANDS = 6;
const WIRES = 14;
const COMBINATIONS = [
  [false, false],
  [false, true],
  [true, false],
  [true, true],
] as const;

test("a half adder with the keyboard: build, wire, check and save", async ({ page }) => {
  await createProjectByKeyboard(page);
  await skipToStructure(page);

  // Step 2: remove the demo NAND with its part menu.
  const region = structureRegion(page);
  await chooseEntry(
    page,
    region.getByRole("button", { name: "Actions for NAND gate 1" }),
    "Delete",
  );
  await expect(region.getByText("NAND gate 1", { exact: true })).toHaveCount(0);

  // Step 3: in the Pins panel, replace OUT with SUM and CARRY.
  await replaceOutputs(page);

  // Step 4: six NANDs.
  const nands: string[] = [];
  for (let added = 0; added < NANDS; added += 1) {
    nands.push(await addPart(page, "NAND"));
  }
  expect(new Set(nands).size).toBe(NANDS);

  // Step 5: fourteen wires.
  for (const wire of halfAdderNamedWires(nands)) {
    await wireByNames(page, wire);
  }

  // Step 6: the export has fourteen wires, and the truth table is a half adder's.
  expect(await exportedWireCount(page, "NAND demo")).toBe(WIRES);
  for (const [a, b] of COMBINATIONS) {
    await setSwitchByKey(page, "A", a);
    await setSwitchByKey(page, "B", b);
    await expect(page.getByText(/^Output SUM: /u)).toHaveText(
      `Output SUM: ${String(Number(a !== b))}`,
    );
    await expect(page.getByText(/^Output CARRY: /u)).toHaveText(
      `Output CARRY: ${String(Number(a && b))}`,
    );
  }

  // Step 7: name the chip "Half adder" and save it with the header's Save.
  await renameChipInLibrary(page, "NAND demo", "Half adder");
  await expect(chipPath(page).locator('[aria-current="page"]')).toHaveText("Half adder");
  await saveOpenChip(page, "Half adder");
  await expect(unsavedDot(page)).toHaveCount(0);
});
