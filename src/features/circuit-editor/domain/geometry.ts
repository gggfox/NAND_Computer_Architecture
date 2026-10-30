/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { ChipInstance, Circuit, Point, Wire } from "~/features/projects";

/** World units are CSS pixels at zoom 1. Chips snap to this grid. */
export const GRID = 40;

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Rect extends Point, Size {}

const PIN_SIZE: Size = { width: GRID, height: GRID };
const NAND_WIDTH = 80;
const NAND_HEIGHT = 60;
const NAND_SIZE: Size = { width: NAND_WIDTH, height: NAND_HEIGHT };
const NAND_PIN_A_FRACTION = 0.25;
const NAND_PIN_B_FRACTION = 0.75;
const HALF = 0.5;
const NAND_PIN_B = 1;
const NAND_PIN_OUT = 2;

/** `nand`, `input`, `output`, `clock`, or `custom` for a placed custom chip. */
export const partOf = (instance: ChipInstance): string =>
  instance.kind.type === "builtin" ? instance.kind.builtin : "custom";

const sizeOf = (instance: ChipInstance): Size =>
  partOf(instance) === "nand" ? NAND_SIZE : PIN_SIZE;

export const rectOf = (instance: ChipInstance): Rect => ({
  ...instance.position,
  ...sizeOf(instance),
});

const nandPin = (rect: Rect, pin: number): Point => {
  if (pin === NAND_PIN_OUT) {
    return { x: rect.x + rect.width, y: rect.y + rect.height * HALF };
  }
  const fraction = pin === NAND_PIN_B ? NAND_PIN_B_FRACTION : NAND_PIN_A_FRACTION;
  return { x: rect.x, y: rect.y + rect.height * fraction };
};

/**
 * Where a pin sits in world space. NAND: 0 = a and 1 = b on the left, 2 = out on the right.
 * An `input` drives from its right edge; every other part is entered from its left edge.
 */
export const pinPosition = (instance: ChipInstance, pin: number): Point => {
  const rect = rectOf(instance);
  const part = partOf(instance);
  if (part === "nand") {
    return nandPin(rect, pin);
  }
  const x = part === "input" ? rect.x + rect.width : rect.x;
  return { x, y: rect.y + rect.height * HALF };
};

/** The polyline a wire is drawn along: stored waypoints, or an orthogonal elbow between its pins. */
export const wireRoute = (circuit: Circuit, wire: Wire): readonly Point[] => {
  const from = circuit.instances.find((item) => item.id === wire.from.instanceId);
  const to = circuit.instances.find((item) => item.id === wire.to.instanceId);
  if (from === undefined || to === undefined) {
    return [];
  }
  const start = pinPosition(from, wire.from.pin);
  const end = pinPosition(to, wire.to.pin);
  if (wire.waypoints.length > 0) {
    return [start, ...wire.waypoints, end];
  }
  const midX = start.x + (end.x - start.x) * HALF;
  return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
};

const overlaps = (first: Rect, second: Rect): boolean =>
  first.x < second.x + second.width &&
  second.x < first.x + first.width &&
  first.y < second.y + second.height &&
  second.y < first.y + first.height;

/** A chip rect grown by one grid step on every side, so placed chips never touch. */
const padded = (rect: Rect): Rect => ({
  x: rect.x - GRID,
  y: rect.y - GRID,
  width: rect.width + GRID + GRID,
  height: rect.height + GRID + GRID,
});

const SEARCH_COLUMNS = 8;
const SEARCH_ROWS = 64;
/** Leave the first columns to the inputs; step two NANDs wide and one-and-a-third NAND tall. */
const FIRST_COLUMN = 160;
const COLUMN_STEP = 160;
const ROW_STEP = 80;

function* candidates(): Generator<Point> {
  for (let row = 0; row < SEARCH_ROWS; row += 1) {
    for (let column = 0; column < SEARCH_COLUMNS; column += 1) {
      yield { x: FIRST_COLUMN + column * COLUMN_STEP, y: row * ROW_STEP };
    }
  }
}

/** The first grid cell (row by row, left to right) where a new NAND touches no existing chip. */
export const freeNandPosition = (circuit: Circuit): Point => {
  const taken = circuit.instances.map((item) => padded(rectOf(item)));
  for (const point of candidates()) {
    const rect = { ...point, ...NAND_SIZE };
    if (!taken.some((other) => overlaps(rect, other))) {
      return point;
    }
  }
  // Every searched cell is full: go below the lowest chip.
  const bottom = Math.max(...taken.map((rect) => rect.y + rect.height));
  return { x: FIRST_COLUMN, y: bottom };
};
