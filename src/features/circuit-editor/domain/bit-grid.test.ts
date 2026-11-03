/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { pinDef } from "~/features/projects";

import { bitAt, bitCells, bitOf, flipBit, hasBitGrid, valueArea } from "./bit-grid";

const BODY = { x: 0, y: 0, width: 80, height: 80 };

describe("hasBitGrid", () => {
  it("is true for inputs wider than one bit only", () => {
    expect(hasBitGrid(pinDef("A", "input", 8))).toBe(true);
    expect(hasBitGrid(pinDef("A", "input"))).toBe(false);
    expect(hasBitGrid(pinDef("Q", "output", 8))).toBe(false);
  });
});

describe("bitCells", () => {
  it("puts four switches to a row along the bottom, most significant first", () => {
    const cells = bitCells(BODY, 8);
    expect(cells.map((cell) => cell.bit)).toEqual([7, 6, 5, 4, 3, 2, 1, 0]);
    expect(cells[0]?.rect).toEqual({ x: 5, y: 41, width: 16, height: 16 });
    expect(cells[7]?.rect).toEqual({ x: 59, y: 59, width: 16, height: 16 });
  });

  it("leaves the body above the switches for the value", () => {
    expect(valueArea(BODY, 8)).toEqual({ ...BODY, height: 40 });
    expect(valueArea({ ...BODY, height: 100 }, 16)).toEqual({ ...BODY, height: 24 });
  });
});

describe("bitAt", () => {
  it("finds the switch under a point, gaps included, and nothing elsewhere", () => {
    expect(bitAt(BODY, 8, { x: 13, y: 49 })).toBe(7);
    expect(bitAt(BODY, 8, { x: 22, y: 49 })).toBe(7);
    expect(bitAt(BODY, 8, { x: 67, y: 67 })).toBe(0);
    expect(bitAt(BODY, 8, { x: 40, y: 20 })).toBeUndefined();
  });
});

describe("bitOf and flipBit", () => {
  it("reads and flips one bit", () => {
    expect(bitOf(0b1010, 1)).toBe(1);
    expect(bitOf(0b1010, 2)).toBe(0);
    expect(flipBit(0b1010, 0)).toBe(0b1011);
    expect(flipBit(0b1010, 3)).toBe(0b0010);
    expect(flipBit(0, 15)).toBe(32_768);
  });
});
