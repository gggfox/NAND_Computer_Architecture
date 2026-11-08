import type { Page } from "@playwright/test";

import { replaceOutputs } from "./keyboard-chips";
import { addPart, chooseEntry, structureRegion, wireByNames } from "./keyboard-support";
import type { NamedPin, NamedWire } from "./keyboard-support";
import { expect } from "./support";

/*
 * The keyboard-only adders: their wires by part and pin names, and the half adder build. The
 * wire order is the order of `halfAdderWires` and `fullAdderWires` in `adder-support`.
 */

const NAND_COUNT = 6;
const input = (name: string): NamedPin => ({ part: `Input ${name}`, pin: name });
const output = (name: string): NamedPin => ({ part: `Output ${name}`, pin: name });
const pin = (part: string | undefined, name: string): NamedPin => ({ part: part ?? "", pin: name });

/**
 * The half adder's fourteen wires as names, in the order of `halfAdderWires` in `adder-support`.
 * `nands` are the six NAND names in the order they were added.
 */
export const halfAdderNamedWires = (nands: readonly string[]): readonly NamedWire[] => {
  const [n1, n2, n3, n4, n5, n6] = nands;
  if (nands.length !== NAND_COUNT || n1 === undefined) {
    throw new Error("A half adder needs six NANDs");
  }
  return [
    // XOR: n4 = NAND(NAND(A, n1), NAND(B, n1)) with n1 = NAND(A, B).
    [input("A"), pin(n1, "a")],
    [input("B"), pin(n1, "b")],
    [input("A"), pin(n2, "a")],
    [pin(n1, "out"), pin(n2, "b")],
    [input("B"), pin(n3, "a")],
    [pin(n1, "out"), pin(n3, "b")],
    [pin(n2, "out"), pin(n4, "a")],
    [pin(n3, "out"), pin(n4, "b")],
    [pin(n4, "out"), output("SUM")],
    // AND: n6 = NOT(NAND(A, B)), the NOT a NAND with both inputs tied.
    [input("A"), pin(n5, "a")],
    [input("B"), pin(n5, "b")],
    [pin(n5, "out"), pin(n6, "a")],
    [pin(n5, "out"), pin(n6, "b")],
    [pin(n6, "out"), output("CARRY")],
  ];
};

/**
 * Makes a half adder in the open demo chip: deletes the demo NAND, replaces OUT with SUM and
 * CARRY, adds six NANDs and makes the fourteen wires. Starts on the structure view.
 */
export const buildHalfAdder = async (page: Page): Promise<void> => {
  const region = structureRegion(page);
  await chooseEntry(
    page,
    region.getByRole("button", { name: "Actions for NAND gate 1" }),
    "Delete",
  );
  await expect(region.getByText("NAND gate 1", { exact: true })).toHaveCount(0);
  await replaceOutputs(page);
  const nands: string[] = [];
  for (let added = 0; added < NAND_COUNT; added += 1) {
    nands.push(await addPart(page, "NAND"));
  }
  expect(new Set(nands).size).toBe(NAND_COUNT);
  for (const wire of halfAdderNamedWires(nands)) {
    await wireByNames(page, wire);
  }
};

const OR_NAND_COUNT = 3;
const HALF_ADDER_COUNT = 2;

/**
 * The full adder's twelve wires as names, in the order of `fullAdderWires` in `adder-support`.
 * The first Half adder adds A and B. The second adds that SUM and CIN. Three NANDs OR the carries.
 */
export const fullAdderNamedWires = (
  halfAdders: readonly string[],
  nands: readonly string[],
): readonly NamedWire[] => {
  const [first, second] = halfAdders;
  const [n1, n2, n3] = nands;
  if (
    halfAdders.length !== HALF_ADDER_COUNT ||
    nands.length !== OR_NAND_COUNT ||
    first === undefined ||
    second === undefined
  ) {
    throw new Error("A full adder needs two Half adders and three NANDs");
  }
  return [
    [input("A"), pin(first, "A")],
    [input("B"), pin(first, "B")],
    [pin(first, "SUM"), pin(second, "A")],
    [input("CIN"), pin(second, "B")],
    [pin(second, "SUM"), output("S")],
    // COUT = OR(c1, c2) = NAND(NOT c1, NOT c2). Each NOT is a NAND with both inputs tied.
    [pin(first, "CARRY"), pin(n1, "a")],
    [pin(first, "CARRY"), pin(n1, "b")],
    [pin(second, "CARRY"), pin(n2, "a")],
    [pin(second, "CARRY"), pin(n2, "b")],
    [pin(n1, "out"), pin(n3, "a")],
    [pin(n2, "out"), pin(n3, "b")],
    [pin(n3, "out"), output("COUT")],
  ];
};
