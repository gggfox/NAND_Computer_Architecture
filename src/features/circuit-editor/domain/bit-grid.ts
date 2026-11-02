/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { BitWidth, PinDef, Point } from "~/features/projects";

import type { Rect } from "./chip-layout";

/** Bits per row of switches. */
const COLUMNS = 4;
/** One switch's square, and the gap around it. */
const PITCH = 18;
const GAP = 1;
const BINARY = 2;
/** Space between the switches and the body's bottom and side edges. */
const MARGIN = 4;

/** One switch: the bit it sets (0 is the least significant) and where it is drawn. */
export interface BitCell {
  readonly bit: number;
  readonly rect: Rect;
}

/** An input wider than one bit is set from its piece by a grid of switches, one per bit. */
export const hasBitGrid = (def: PinDef): boolean => def.direction === "input" && def.width > 1;

/**
 * The switches of a `width`-bit piece whose body is `rect`: four to a row along the bottom, the
 * most significant bit first, so the grid reads like the binary value in the Pins panel.
 */
export const bitCells = (rect: Rect, width: BitWidth): readonly BitCell[] => {
  const rows = Math.ceil(width / COLUMNS);
  const left = rect.x + MARGIN;
  const top = rect.y + rect.height - MARGIN - rows * PITCH;
  return Array.from({ length: width }, (_unused, index) => ({
    bit: width - 1 - index,
    rect: {
      x: left + (index % COLUMNS) * PITCH + GAP,
      y: top + Math.floor(index / COLUMNS) * PITCH + GAP,
      width: PITCH - GAP - GAP,
      height: PITCH - GAP - GAP,
    },
  }));
};

/** The body above the switches, where the decimal value goes. */
export const valueArea = (rect: Rect, width: BitWidth): Rect => {
  const height = rect.height - MARGIN - Math.ceil(width / COLUMNS) * PITCH;
  return { ...rect, height };
};

const contains = (rect: Rect, point: Point): boolean =>
  point.x >= rect.x - GAP &&
  point.x <= rect.x + rect.width + GAP &&
  point.y >= rect.y - GAP &&
  point.y <= rect.y + rect.height + GAP;

/** The bit whose switch is at `point` (world units); `undefined` off the switches. */
export const bitAt = (rect: Rect, width: BitWidth, point: Point): number | undefined =>
  bitCells(rect, width).find((cell) => contains(cell.rect, point))?.bit;

/** Bit `bit` of `value`: 0 or 1. */
export const bitOf = (value: number, bit: number): 0 | 1 =>
  Math.floor(value / BINARY ** bit) % BINARY === 0 ? 0 : 1;

/** `value` with bit `bit` flipped. */
export const flipBit = (value: number, bit: number): number =>
  bitOf(value, bit) === 0 ? value + BINARY ** bit : value - BINARY ** bit;
