/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { pinDef } from "~/features/projects";
import type { BitWidth, Circuit, PinDirection, Point } from "~/features/projects";

import { GRID, layoutOfKind } from "./chip-layout";
import type { Rect } from "./chip-layout";
import { layoutIn, partOf } from "./geometry";
import type { Scene } from "./geometry";
import { snap } from "./move";

/** The space between stacked pin pieces. */
export const PIN_ROW_GAP = GRID;
/** The space between a pin column and the other parts. */
export const PIN_COLUMN_GAP = GRID + GRID;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LETTERS = ALPHABET.length;
/** Outputs start their own column this many grid steps right when there is nothing else. */
const EMPTY_OUTPUT_STEPS = 6;
const EMPTY_OUTPUT_X = EMPTY_OUTPUT_STEPS * GRID;

/** Spreadsheet column names: 0 is `A`, 25 is `Z`, 26 is `AA`. */
const columnName = (index: number): string => {
  const prefix = index < LETTERS ? "" : columnName(Math.floor(index / LETTERS) - 1);
  return prefix + ALPHABET.charAt(index % LETTERS);
};

const nameAt = (direction: PinDirection, index: number): string =>
  direction === "input" ? columnName(index) : `OUT${String(index + 1)}`;

/**
 * The next `count` free names for new pins: inputs `A…Z, AA, AB…`, outputs `OUT1, OUT2…`. A name
 * any pin already holds, of either direction, is skipped (case-sensitive).
 */
export const nextPinNames = (
  circuit: Circuit,
  direction: PinDirection,
  count: number,
): readonly string[] => {
  const used = new Set(circuit.pins.map((pin) => pin.name));
  const names: string[] = [];
  for (let index = 0; names.length < count; index += 1) {
    const name = nameAt(direction, index);
    if (!used.has(name)) {
      names.push(name);
    }
  }
  return names;
};

/** How tall a pin piece of `width` is drawn. */
const pieceHeight = (scene: Scene, direction: PinDirection, width: BitWidth): number => {
  const probe = pinDef("", direction, width);
  const circuit: Circuit = { ...scene.circuit, pins: [probe] };
  const origin = { x: 0, y: 0 };
  return layoutOfKind({ ...scene, circuit }, { type: "pin", pinId: probe.id }, origin).rect.height;
};

const bottomOf = (rect: Rect): number => rect.y + rect.height;

/** Below the lowest piece of the column, at its x. */
const belowColumn = (column: readonly Rect[]): Point => {
  const lowest = column.reduce((low, rect) => (bottomOf(rect) > bottomOf(low) ? rect : low));
  return { x: lowest.x, y: bottomOf(lowest) + PIN_ROW_GAP };
};

/** A new column beside the non-pin parts, level with their top. */
const besideParts = (parts: readonly Rect[], direction: PinDirection): Point => {
  if (parts.length === 0) {
    return { x: direction === "input" ? 0 : EMPTY_OUTPUT_X, y: 0 };
  }
  const y = Math.min(...parts.map((rect) => rect.y));
  const x =
    direction === "input"
      ? Math.min(...parts.map((rect) => rect.x)) - PIN_COLUMN_GAP - GRID
      : Math.max(...parts.map((rect) => rect.x + rect.width)) + PIN_COLUMN_GAP;
  return { x, y };
};

const columnStart = (scene: Scene, direction: PinDirection): Point => {
  const { instances } = scene.circuit;
  const rect = (item: (typeof instances)[number]): Rect => layoutIn(scene, item).rect;
  const column = instances
    .filter((item) => partOf(scene.circuit, item) === direction)
    .map((item) => rect(item));
  if (column.length > 0) {
    return belowColumn(column);
  }
  const parts = instances.filter((item) => item.kind.type !== "pin").map((item) => rect(item));
  return besideParts(parts, direction);
};

/**
 * Where new pin pieces of `direction` and these `widths` go, in order: stacked below the lowest
 * piece of that direction, or in a new column beside the other parts (inputs left, outputs
 * right). Each piece's top is `PIN_ROW_GAP` below the one above it; every point is on the grid.
 */
export const columnPositions = (
  scene: Scene,
  direction: PinDirection,
  widths: readonly BitWidth[],
): readonly Point[] => {
  const start = columnStart(scene, direction);
  let top = start.y;
  return widths.map((width) => {
    const point = snap({ x: start.x, y: top });
    top = point.y + pieceHeight(scene, direction, width) + PIN_ROW_GAP;
    return point;
  });
};
