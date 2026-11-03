/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { findChip } from "~/features/projects";
import type {
  BitWidth,
  ChipInstance,
  Circuit,
  InstanceKind,
  PinKey,
  Point,
  Project,
} from "~/features/projects";
import { assertNever } from "~/shared/assert-never";

import { partName } from "./messages";

const HALF = 0.5;
/** World units are CSS pixels at zoom 1. Chips snap to this grid. */
export const GRID = 40;
/** Pins are laid out in half-grid cells (Lague's grid rule, scaled for touch). */
export const PIN_CELL = GRID * HALF;
/** Pin labels use a 13 px monospace font, so their width is exact. */
const CHAR_WIDTH = 8;
/** Titles use a bold proportional font; this is a generous per-character estimate. */
const TITLE_CHAR_WIDTH = 10;
/** Space between the chip edge and a pin label, past the half of the pin tab inside the chip. */
const LABEL_INSET = 8;
/** Space between a pin piece's body and its name, which sits outside the body. */
const NAME_GAP = 8;
/** Space between a label column and the title. */
const TITLE_GAP = 4;
/** The fewest cells a side may take: one 1-bit pin. */
const MIN_CELLS = 2;
const MIN_WIDTH = GRID + GRID;
/** Label inset and title gap, on each side of the title. */
const SIDE_PADDING = LABEL_INSET + TITLE_GAP;
const TAB_SIZE = 12;
/** A bus tab is its slot's height less this much, so neighbouring tabs never touch. */
const TAB_MARGIN = 8;
const NAND_OUT = 2;

/** A 1-, 4-, 8- or 16-bit pin takes 2, 3, 4 or 5 cells. */
const SLOT_CELLS: Readonly<Record<BitWidth, number>> = { 1: 2, 4: 3, 8: 4, 16: 5 };

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Rect extends Point, Size {}

type Side = "left" | "right";

interface PinLayout {
  readonly key: PinKey;
  /** The pin's name, with its width for a bus: `a`, `d[4]`. */
  readonly label: string;
  readonly width: BitWidth;
  readonly side: Side;
  /** Where wires attach: on the chip's edge, in world units. */
  readonly anchor: Point;
  /** The drawn pin: a square for one bit, a taller tab for a bus. */
  readonly tab: Rect;
}

export interface ChipLayout {
  readonly rect: Rect;
  readonly title: string;
  /** Left side top to bottom, then right side top to bottom. */
  readonly pins: readonly PinLayout[];
  /** A pin piece's name: outside the body, on the side away from its pin. Other parts have none. */
  readonly name?: Rect;
}

/** What laying out an instance depends on besides the instance itself. */
export interface LayoutSource {
  readonly project: Project;
  readonly circuit: Circuit;
}

interface PinSpec {
  readonly key: PinKey;
  readonly name: string;
  readonly width: BitWidth;
  readonly side: Side;
}

const spec = (key: PinKey, name: string, side: Side): PinSpec => ({ key, name, width: 1, side });

const bus = (pin: PinSpec, width: BitWidth): PinSpec => ({ ...pin, width });

const NAND_PINS: readonly PinSpec[] = [
  spec(0, "a", "left"),
  spec(1, "b", "left"),
  spec(NAND_OUT, "out", "right"),
];
const CLOCK_PINS: readonly PinSpec[] = [spec(0, "out", "right")];

const bits = (count: number, side: Side, first: number): readonly PinSpec[] =>
  Array.from({ length: count }, (_unused, bit) => spec(first + bit, String(bit), side));

const customPins = (project: Project, chipId: string): readonly PinSpec[] =>
  (project.chips.find((chip) => chip.id === chipId)?.saved?.pins ?? []).map((pin) =>
    bus(spec(pin.id, pin.name, pin.direction === "input" ? "left" : "right"), pin.width),
  );

/** A pin piece's one pin faces into the chip: an input drives from its right edge. */
const piecePins = (circuit: Circuit, pinId: string): readonly PinSpec[] => {
  const def = circuit.pins.find((pin) => pin.id === pinId);
  return def === undefined
    ? []
    : [bus(spec(0, def.name, def.direction === "input" ? "right" : "left"), def.width)];
};

/** Built-ins use their fixed numbering (NAND 0 = a, 1 = b, 2 = out; split 0 = in; merge n = out). */
const pinSpecs = ({ project, circuit }: LayoutSource, kind: InstanceKind): readonly PinSpec[] => {
  switch (kind.type) {
    case "nand": {
      return NAND_PINS;
    }
    case "clock": {
      return CLOCK_PINS;
    }
    case "split": {
      return [bus(spec(0, "in", "left"), kind.width), ...bits(kind.width, "right", 1)];
    }
    case "merge": {
      return [...bits(kind.width, "left", 0), bus(spec(kind.width, "out", "right"), kind.width)];
    }
    case "pin": {
      return piecePins(circuit, kind.pinId);
    }
    case "custom": {
      return customPins(project, kind.chipId);
    }
    default: {
      return assertNever(kind);
    }
  }
};

const labelOf = (pin: PinSpec): string =>
  pin.width === 1 ? pin.name : `${pin.name}[${String(pin.width)}]`;

const cellsOf = (pins: readonly PinSpec[]): number =>
  pins.reduce((sum, pin) => sum + SLOT_CELLS[pin.width], 0);

const widestLabel = (pins: readonly PinSpec[]): number =>
  Math.max(0, ...pins.map((pin) => labelOf(pin).length * CHAR_WIDTH));

const ceilToGrid = (value: number): number => Math.ceil(value / GRID) * GRID;

interface Sides {
  readonly left: readonly PinSpec[];
  readonly right: readonly PinSpec[];
}

/**
 * A pin piece's body at `position`: one grid wide, or two for an input wider than one bit, whose
 * bits are switches (bit-grid.ts). That body grows to the left, so the pin and its wires stay put.
 */
const pieceRect = (position: Point, size: Size, pin: PinSpec | undefined): Rect =>
  pin !== undefined && pin.side === "right" && pin.width > 1
    ? { x: position.x - GRID, y: position.y, width: size.width + GRID, height: size.height }
    : { ...position, ...size };

const bodySize = (sides: Sides, title: string, isPiece: boolean): Size => {
  const cells = Math.max(MIN_CELLS, cellsOf(sides.left), cellsOf(sides.right));
  if (isPiece) {
    return { width: GRID, height: cells * PIN_CELL };
  }
  const text = widestLabel(sides.left) + title.length * TITLE_CHAR_WIDTH + widestLabel(sides.right);
  return {
    width: Math.max(MIN_WIDTH, ceilToGrid(text + SIDE_PADDING + SIDE_PADDING)),
    height: cells * PIN_CELL,
  };
};

const tabOf = (anchor: Point, width: BitWidth): Rect => {
  const height = width === 1 ? TAB_SIZE : SLOT_CELLS[width] * PIN_CELL - TAB_MARGIN;
  return { x: anchor.x - TAB_SIZE * HALF, y: anchor.y - height * HALF, width: TAB_SIZE, height };
};

/**
 * Stacks one side's slots top to bottom, spreading the slack evenly around them, then snaps each
 * slot centre to the nearest half-grid cell so the router can rely on a lattice. Centres stay
 * strictly increasing: a pin that would land on or above the previous one moves down a cell.
 */
const placeSide = (rect: Rect, pins: readonly PinSpec[]): readonly PinLayout[] => {
  const gap = (rect.height / PIN_CELL - cellsOf(pins)) / (pins.length + 1);
  let cell = 0;
  let previous = 0;
  return pins.map((pin) => {
    const slot = SLOT_CELLS[pin.width];
    cell += gap;
    const snapped = Math.max(Math.round(cell + slot * HALF), previous + 1);
    previous = snapped;
    const centre = snapped * PIN_CELL;
    cell += slot;
    const anchor = { x: pin.side === "left" ? rect.x : rect.x + rect.width, y: rect.y + centre };
    const { key, width, side } = pin;
    return { key, label: labelOf(pin), width, side, anchor, tab: tabOf(anchor, width) };
  });
};

/** Where a pin piece's name goes: one cell high, centred beside the body, away from its pin. */
const nameRect = (rect: Rect, title: string, pinSide: Side | undefined): Rect => {
  const width = title.length * CHAR_WIDTH;
  const x = pinSide === "left" ? rect.x + rect.width + NAME_GAP : rect.x - NAME_GAP - width;
  return { x, y: rect.y + (rect.height - PIN_CELL) * HALF, width, height: PIN_CELL };
};

/**
 * The body, title and pins of a part of `kind` at `position` (spec §5.1): inputs on the left and outputs on the right,
 * each pin in a slot of 2, 3, 4 or 5 half-grid cells by width, slack spread evenly, the height
 * set by the taller side and the width by the title and the widest labels (a multiple of the
 * grid). A pin piece is one grid wide (see `pieceRect`). A custom chip that is unsaved or missing has no pins.
 */
export const layoutOfKind = (
  source: LayoutSource,
  kind: InstanceKind,
  position: Point,
): ChipLayout => {
  const specs = pinSpecs(source, kind);
  const sides: Sides = {
    left: specs.filter((pin) => pin.side === "left"),
    right: specs.filter((pin) => pin.side === "right"),
  };
  const title = partName(source.project, source.circuit, kind);
  const isPiece = kind.type === "pin";
  const size = bodySize(sides, title, isPiece);
  const rect = isPiece ? pieceRect(position, size, specs[0]) : { ...position, ...size };
  const pins = [...placeSide(rect, sides.left), ...placeSide(rect, sides.right)];
  return isPiece
    ? { rect, title, pins, name: nameRect(rect, title, specs[0]?.side) }
    : { rect, title, pins };
};

export const layoutOf = (source: LayoutSource, instance: ChipInstance): ChipLayout =>
  layoutOfKind(source, instance.kind, instance.position);

/** What a layout depends on besides its instance: the custom chip or the pin definition. */
const dependencyOf = ({ project, circuit }: LayoutSource, instance: ChipInstance): unknown => {
  const { kind } = instance;
  if (kind.type === "custom") {
    return findChip(project, kind.chipId);
  }
  return kind.type === "pin" ? circuit.pins.find((pin) => pin.id === kind.pinId) : undefined;
};

export type LayoutCache = (source: LayoutSource, instance: ChipInstance) => ChipLayout;

/**
 * `layoutOf`, memoised per instance object and what it depends on (a renamed or re-saved custom
 * chip, an edited pin definition), so the renderer and hit-testing share one layout per frame.
 */
export const createLayoutCache = (): LayoutCache => {
  const cache = new WeakMap<ChipInstance, { readonly on: unknown; readonly layout: ChipLayout }>();
  return (source, instance) => {
    const on = dependencyOf(source, instance);
    const known = cache.get(instance);
    if (known !== undefined && known.on === on) {
      return known.layout;
    }
    const layout = layoutOf(source, instance);
    cache.set(instance, { on, layout });
    return layout;
  };
};
