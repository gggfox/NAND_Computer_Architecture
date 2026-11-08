import { buildHalfAdder } from "./keyboard-adders";
import { renameChipInLibrary, saveOpenChip } from "./keyboard-chips";
import {
  createProjectByKeyboard,
  exportedWireCount,
  setSwitchByKey,
  skipToStructure,
} from "./keyboard-support";
import { chipPath, unsavedDot } from "./save-support";
import { expect, test } from "./support";

/*
 * A half adder built, checked and saved with the keyboard alone (phase 6, spec 3.2). No pointer,
 * no tap, no canvas coordinates. Wires are made in "Wire to…" by part and pin names.
 */

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

  // Steps 2 to 5: the half adder's parts, pins and fourteen wires.
  await buildHalfAdder(page);

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
