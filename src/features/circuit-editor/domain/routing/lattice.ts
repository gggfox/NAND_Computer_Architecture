/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Point } from "~/features/projects";

/**
 * The routing lattice: one node per `PIN_CELL` inside a search window, in cell units. Node `n` is
 * at `(minX + n % width, minY + floor(n / width))`. Headings are 0 = +x, 1 = +y, 2 = −x, 3 = −y.
 */

/** No signal uses this node or edge. */
export const FREE = -1;
/** Two different signals already use it, so it is taken for every signal. */
const MIXED = -2;

export const DX: readonly number[] = [1, 0, -1, 0];
export const DY: readonly number[] = [0, 1, 0, -1];

/** A closed box of cells. */
export interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Another wire's polyline in cells (no repeated or collinear middle points), with its signal and box. */
export interface CellRoute {
  readonly signal: number;
  readonly points: readonly Point[];
  readonly box: Box;
}

/** A pin's anchor node and the heading its one-cell stub leaves in. */
export interface Stub {
  readonly anchor: Point;
  readonly heading: number;
}

export interface Lattice {
  readonly box: Box;
  readonly width: number;
  readonly height: number;
  /** 1 inside a chip rect grown by one cell (the cells of the closed rect). */
  readonly blocked: Uint8Array;
  /** The signal on each node: `FREE`, a signal number or `MIXED`. */
  readonly nodes: Int32Array;
  /** 1 where a signal turns or ends, so no other signal may pass. */
  readonly stops: Uint8Array;
  /** The signal on the edge from node `n` to `n + 1`. */
  readonly across: Int32Array;
  /** The signal on the edge from node `n` to `n + width`. */
  readonly down: Int32Array;
}

export interface LatticeSpec {
  readonly box: Box;
  readonly rects: readonly Box[];
  readonly routes: Iterable<CellRoute>;
  /** The wire's own two stubs: free of chips and other signals. */
  readonly stubs: readonly Stub[];
}

const overlapsBox = (first: Box, second: Box): boolean =>
  first.minX <= second.maxX &&
  second.minX <= first.maxX &&
  first.minY <= second.maxY &&
  second.minY <= first.maxY;

export const nodeAt = (lattice: Lattice, point: Point): number => {
  const { box, width } = lattice;
  const inside =
    point.x >= box.minX && point.x <= box.maxX && point.y >= box.minY && point.y <= box.maxY;
  return inside ? point.x - box.minX + (point.y - box.minY) * width : FREE;
};

const merged = (current: number, signal: number): number =>
  current === FREE || current === signal ? signal : MIXED;

const blockRect = (lattice: Lattice, rect: Box) => {
  const { box, width, blocked } = lattice;
  for (let y = Math.max(rect.minY, box.minY); y <= Math.min(rect.maxY, box.maxY); y += 1) {
    const row = (y - box.minY) * width - box.minX;
    for (let x = Math.max(rect.minX, box.minX); x <= Math.min(rect.maxX, box.maxX); x += 1) {
      blocked[row + x] = 1;
    }
  }
};

/** Marks the edge between two neighbouring cells, and the cell it reaches. */
const markStep = (lattice: Lattice, step: readonly [Point, Point], signal: number) => {
  const [from, to] = step;
  const first = nodeAt(lattice, from);
  const second = nodeAt(lattice, to);
  if (first === FREE || second === FREE) {
    return;
  }
  const edges = from.y === to.y ? lattice.across : lattice.down;
  const edge = Math.min(first, second);
  edges[edge] = merged(Number(edges[edge]), signal);
  lattice.nodes[second] = merged(Number(lattice.nodes[second]), signal);
};

const markStop = (lattice: Lattice, point: Point, signal: number) => {
  const node = nodeAt(lattice, point);
  if (node !== FREE) {
    lattice.nodes[node] = merged(Number(lattice.nodes[node]), signal);
    lattice.stops[node] = 1;
  }
};

/** Marks an axis-aligned line cell by cell. */
const markLine = (lattice: Lattice, line: readonly [Point, Point], signal: number) => {
  const [from, to] = line;
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  let point = from;
  while (point.x !== to.x || point.y !== to.y) {
    const next = { x: point.x + dx, y: point.y + dy };
    markStep(lattice, [point, next], signal);
    point = next;
  }
};

/** Marks a segment across first then down, so a diagonal (a hand bend) reads as an elbow. */
const markSegment = (lattice: Lattice, segment: readonly [Point, Point], signal: number) => {
  const [from, to] = segment;
  const corner = { x: to.x, y: from.y };
  markLine(lattice, [from, corner], signal);
  markLine(lattice, [corner, to], signal);
};

/** Marks a route; its points are normalised (no repeats, no collinear middles), so each one stops. */
const markRoute = (lattice: Lattice, route: CellRoute) => {
  const { points, signal } = route;
  points.forEach((point, index) => {
    const before = points[index - 1];
    if (before !== undefined) {
      markSegment(lattice, [before, point], signal);
    }
    markStop(lattice, point, signal);
  });
};

/**
 * A wire's own anchor, stub edge and stub's outer cell are its alone: wires of other signals that
 * leave or enter the same pin (another colour, another bit) share them unavoidably. The anchor is
 * also cleared of its chip. Both cells are in the window.
 */
const clearStub = (lattice: Lattice, stub: Stub) => {
  const { anchor, heading } = stub;
  const node = nodeAt(lattice, anchor);
  const outer = nodeAt(lattice, {
    x: anchor.x + Number(DX[heading]),
    y: anchor.y + Number(DY[heading]),
  });
  lattice.blocked[node] = 0;
  lattice.nodes[node] = FREE;
  lattice.stops[node] = 0;
  lattice.nodes[outer] = FREE;
  lattice.stops[outer] = 0;
  // Pins sit on a chip's left or right side, so a stub is always horizontal.
  lattice.across[Math.min(node, outer)] = FREE;
};

const markRoutes = (lattice: Lattice, routes: Iterable<CellRoute>) => {
  for (const route of routes) {
    if (overlapsBox(route.box, lattice.box)) {
      markRoute(lattice, route);
    }
  }
};

const emptyLattice = (box: Box): Lattice => {
  const width = box.maxX - box.minX + 1;
  const height = box.maxY - box.minY + 1;
  const size = width * height;
  return {
    box,
    width,
    height,
    blocked: new Uint8Array(size),
    nodes: new Int32Array(size).fill(FREE),
    stops: new Uint8Array(size),
    across: new Int32Array(size).fill(FREE),
    down: new Int32Array(size).fill(FREE),
  };
};

/** The lattice over `spec.box`: chips blocked, other signals' routes marked, own stubs cleared. */
export const buildLattice = (spec: LatticeSpec): Lattice => {
  const { box } = spec;
  const lattice = emptyLattice(box);
  for (const rect of spec.rects) {
    if (overlapsBox(rect, box)) {
      blockRect(lattice, rect);
    }
  }
  markRoutes(lattice, spec.routes);
  for (const stub of spec.stubs) {
    clearStub(lattice, stub);
  }
  return lattice;
};
