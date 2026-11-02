/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Page } from "@playwright/test";

import { piecePosition } from "./pins-support";
import { expect, spoken, worldToPage } from "./support";
import type { ExportedFile, Point } from "./support";
import type { Pointer } from "./wiring-support";

/** Helpers for the phone adder specs: where parts' pins are, and wiring them with taps. */

/** Where wires attach, relative to a part's position (`placeSide` in `domain/chip-layout.ts`). */
export const NAND_PIN = { a: { x: 0, y: 20 }, b: { x: 0, y: 60 }, out: { x: 120, y: 40 } } as const;
/** An input piece drives from its right edge; an output piece takes its wire on its left. */
export const INPUT_PIN: Point = { x: 40, y: 20 };
export const OUTPUT_PIN: Point = { x: 0, y: 20 };

/** A wire as world points: from an output pin to an input pin. */
export type WireEnds = readonly [Point, Point];

export const offset = (at: Point, by: Point): Point => ({ x: at.x + by.x, y: at.y + by.y });

export const placed = (point: Point | undefined): Point => {
  if (point === undefined) {
    throw new Error("A part is missing from the export");
  }
  return point;
};

/** A NAND's three pins, in world units, from its position. */
export const nandPins = (at: Point | undefined) => {
  const position = placed(at);
  return {
    a: offset(position, NAND_PIN.a),
    b: offset(position, NAND_PIN.b),
    out: offset(position, NAND_PIN.out),
  };
};

export interface HalfAdderBoard {
  readonly a: Point;
  readonly b: Point;
  readonly sum: Point;
  readonly carry: Point;
  readonly nands: readonly Point[];
}

/** Where every part of the half adder in chip `chip` landed, read from the exported file. */
export const halfAdderBoard = (file: ExportedFile, chip = 0): HalfAdderBoard => ({
  a: placed(piecePosition(file, "A", chip)),
  b: placed(piecePosition(file, "B", chip)),
  sum: placed(piecePosition(file, "SUM", chip)),
  carry: placed(piecePosition(file, "CARRY", chip)),
  nands: (file.project.chips[chip]?.draft.instances ?? [])
    .filter((item) => item.kind.type === "nand")
    .map((item) => item.position),
});

/** The NANDs in the order they were added (and exported). */
const NAND_ORDER = { n1: 0, n2: 1, n3: 2, n4: 3, n5: 4, n6: 5 } as const;

/** A half adder's fourteen wires: an XOR of four NANDs into SUM, an AND of two into CARRY. */
export const halfAdderWires = (board: HalfAdderBoard): readonly WireEnds[] => {
  const [n1, n2, n3, n4, n5, n6] = [
    nandPins(board.nands[NAND_ORDER.n1]),
    nandPins(board.nands[NAND_ORDER.n2]),
    nandPins(board.nands[NAND_ORDER.n3]),
    nandPins(board.nands[NAND_ORDER.n4]),
    nandPins(board.nands[NAND_ORDER.n5]),
    nandPins(board.nands[NAND_ORDER.n6]),
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
export const wireByTaps = async (
  page: Page,
  pointer: Pointer,
  wires: readonly WireEnds[],
): Promise<void> => {
  for (const [from, to] of wires) {
    await pointer.tap(await worldToPage(page, from));
    await expect(spoken(page)).toHaveText(/ready to wire/u);
    await pointer.tap(await worldToPage(page, to));
    await expect(spoken(page)).toHaveText(/Wire added/u);
  }
};

/** The index of the chip named `name` in an exported project. */
export const chipIndex = (file: ExportedFile, name: string): number =>
  file.project.chips.findIndex((chip) => chip.name === name);

/** A placed Half adder's pins (four 1-bit pins, a 200 × 80 body), relative to its position. */
const HALF_ADDER_PIN = {
  a: { x: 0, y: 20 },
  b: { x: 0, y: 60 },
  sum: { x: 200, y: 20 },
  carry: { x: 200, y: 60 },
} as const;

const halfAdderPins = (at: Point | undefined) => {
  const position = placed(at);
  return {
    a: offset(position, HALF_ADDER_PIN.a),
    b: offset(position, HALF_ADDER_PIN.b),
    sum: offset(position, HALF_ADDER_PIN.sum),
    carry: offset(position, HALF_ADDER_PIN.carry),
  };
};

/**
 * Full adder's twelve wires, from its parts in the export: two Half adders chained (the first
 * placed adds A and B, the second adds that SUM and CIN), and their carries ORed by three NANDs.
 */
export const fullAdderWires = (file: ExportedFile): readonly WireEnds[] => {
  const chip = chipIndex(file, "Full adder");
  const parts = file.project.chips[chip]?.draft.instances ?? [];
  const [first, second] = parts
    .filter((part) => part.kind.type === "custom")
    .map((part) => halfAdderPins(part.position));
  const [n1, n2, n3] = parts
    .filter((part) => part.kind.type === "nand")
    .map((part) => nandPins(part.position));
  if (
    first === undefined ||
    second === undefined ||
    n1 === undefined ||
    n2 === undefined ||
    n3 === undefined
  ) {
    throw new Error("A part of Full adder is missing from the export");
  }
  const input = (name: string): Point => offset(placed(piecePosition(file, name, chip)), INPUT_PIN);
  const output = (name: string): Point =>
    offset(placed(piecePosition(file, name, chip)), OUTPUT_PIN);
  return [
    [input("A"), first.a],
    [input("B"), first.b],
    [first.sum, second.a],
    [input("CIN"), second.b],
    [second.sum, output("S")],
    // COUT = OR(c1, c2) = NAND(NOT c1, NOT c2), each NOT a NAND with both inputs tied.
    [first.carry, n1.a],
    [first.carry, n1.b],
    [second.carry, n2.a],
    [second.carry, n2.b],
    [n1.out, n3.a],
    [n2.out, n3.b],
    [n3.out, output("COUT")],
  ];
};
