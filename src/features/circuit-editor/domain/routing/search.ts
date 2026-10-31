/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import { DX, DY, FREE } from "./lattice";
import type { Lattice } from "./lattice";
import { prepare } from "./scratch";
import type { Scratch } from "./scratch";

/** Costs are in half cells, so every cost is a whole number. */
const CELL = 2;
/** A cell on an edge the same signal already uses: trunks merge. */
const TRUNK = 1;
const BEND = 6;
const CROSS = 8;
/** What a clash with another signal costs in the relaxed pass; the strict pass forbids it. */
const PENALTY = 40;
const FORBIDDEN = Number.POSITIVE_INFINITY;
/** Priorities are `cost * ORDER + insertion`, so equal costs pop in insertion order. */
const ORDER = 16_777_216;
/** A state is `node << HEADING_BITS | heading`. */
const HEADING_BITS = 2;
const HEADING_MASK = 3;
/** `heading ^ REVERSE` turns a heading round (0 and 2, 1 and 3 are opposites). */
const REVERSE = 2;
/*
 * Module-local copies: hot loops read these on every step, and a test runner's module transform
 * turns each imported name into a property read on the module namespace.
 */
const NONE = FREE;
const STEP_X = DX;
const STEP_Y = DY;

export interface SearchSpec {
  readonly lattice: Lattice;
  /** The start anchor's node, left along `startHeading`. */
  readonly start: number;
  readonly startHeading: number;
  /**
   * The end anchor's node. Like the start, its only free neighbour is its stub's outer cell (the
   * rest are inside its chip), so it is entered along the stub, heading into the chip.
   */
  readonly goal: number;
  readonly signal: number;
  /** Clashes with other signals cost `PENALTY` instead of being forbidden. */
  readonly relaxed: boolean;
  readonly scratch: Scratch;
}

interface Heap {
  readonly keys: number[];
  readonly states: number[];
  count: number;
}

/** Moves parents down from the new last slot while they rank after `key`; returns the hole. */
const siftUp = (heap: Heap, key: number): number => {
  const { keys, states } = heap;
  let index = keys.length;
  while (index > 0 && Number(keys[(index - 1) >> 1]) > key) {
    const up = (index - 1) >> 1;
    keys[index] = Number(keys[up]);
    states[index] = Number(states[up]);
    index = up;
  }
  return index;
};

const push = (heap: Heap, state: number, cost: number) => {
  const key = cost * ORDER + heap.count;
  heap.count += 1;
  const index = siftUp(heap, key);
  heap.keys[index] = key;
  heap.states[index] = state;
};

const smallerChild = (keys: readonly number[], index: number): number => {
  const left = index + index + 1;
  return left + 1 < keys.length && Number(keys[left + 1]) < Number(keys[left]) ? left + 1 : left;
};

/** Moves children up from the root while they rank before `key`; returns the hole. */
const siftDown = (heap: Heap, key: number): number => {
  const { keys, states } = heap;
  let index = 0;
  let child = smallerChild(keys, index);
  while (child < keys.length && Number(keys[child]) < key) {
    keys[index] = Number(keys[child]);
    states[index] = Number(states[child]);
    index = child;
    child = smallerChild(keys, index);
  }
  return index;
};

/** Takes the top, then puts the last entry in the hole sifted down from the root. */
const pop = (heap: Heap): number => {
  const { keys, states } = heap;
  const top = Number(states[0]);
  const key = Number(keys.pop());
  const state = Number(states.pop());
  if (keys.length > 0) {
    const index = siftDown(heap, key);
    keys[index] = key;
    states[index] = state;
  }
  return top;
};

interface Run {
  readonly spec: SearchSpec;
  readonly width: number;
  readonly goalX: number;
  readonly goalY: number;
  readonly scratch: Scratch;
  readonly generation: number;
  readonly heap: Heap;
  /** Whether the search reached the window's border, so a wider window might succeed. */
  reachedBorder: boolean;
}

const isOther = (spec: SearchSpec, signal: number): boolean =>
  signal !== NONE && signal !== spec.signal;

const clash = (spec: SearchSpec): number => (spec.relaxed ? PENALTY : FORBIDDEN);

/**
 * Bending costs `BEND`, and never happens on another signal's node. An anchor cannot bend: its
 * neighbours along the chip edge are inside the chip.
 */
const turnCost = (spec: SearchSpec, state: number, heading: number): number => {
  if ((state & HEADING_MASK) === heading) {
    return 0;
  }
  return (
    BEND + (isOther(spec, Number(spec.lattice.nodes[state >> HEADING_BITS])) ? clash(spec) : 0)
  );
};

const edgeCost = (spec: SearchSpec, node: number, move: number): number => {
  const edges = (move & 1) === 0 ? spec.lattice.across : spec.lattice.down;
  const signal = Number(edges[Math.min(node, move >> HEADING_BITS)]);
  if (signal === NONE) {
    return CELL;
  }
  return signal === spec.signal ? TRUNK : CELL + clash(spec);
};

/** Entering another signal's node is a crossing; where it turns or ends, a clash. */
const nodeCost = (spec: SearchSpec, next: number): number => {
  const { nodes, stops } = spec.lattice;
  if (!isOther(spec, Number(nodes[next]))) {
    return 0;
  }
  return stops[next] === 1 ? clash(spec) : CROSS;
};

/** The cost of moving from `state` (node and heading) to `move` (next node and heading). */
const stepCost = (spec: SearchSpec, state: number, move: number): number => {
  const next = move >> HEADING_BITS;
  if (spec.lattice.blocked[next] === 1) {
    return FORBIDDEN;
  }
  const turn = turnCost(spec, state, move & HEADING_MASK);
  return turn + edgeCost(spec, state >> HEADING_BITS, move) + nodeCost(spec, next);
};

/**
 * The Manhattan distance from `node` to the goal at full cell cost. Trunk cells cost less, so near
 * a trunk this can overestimate a little; the search stays deterministic, if not always optimal.
 */
const estimate = (run: Run, node: number): number => {
  const x = node % run.width;
  const y = (node - x) / run.width;
  return (Math.abs(x - run.goalX) + Math.abs(y - run.goalY)) * CELL;
};

/** Records `move` if reaching it through `state` (an expanded, so seen, state) is cheaper. */
const relax = (run: Run, state: number, move: number) => {
  const { best, parent, seen } = run.scratch;
  const cost = Number(best[state]) + stepCost(run.spec, state, move);
  const known = seen[move] === run.generation ? Number(best[move]) : FORBIDDEN;
  if (cost < known) {
    best[move] = cost;
    parent[move] = state;
    seen[move] = run.generation;
    push(run.heap, move, cost + estimate(run, move >> HEADING_BITS));
  }
};

/** Steps from `state` along `heading`: never back the way it came, nor out of the window. */
const step = (run: Run, state: number, heading: number) => {
  const { width } = run;
  const node = state >> HEADING_BITS;
  const x = (node % width) + Number(STEP_X[heading]);
  const y = Math.floor(node / width) + Number(STEP_Y[heading]);
  if (x < 0 || y < 0 || x >= width || y >= run.spec.lattice.height) {
    run.reachedBorder = true;
  } else if (heading !== ((state & HEADING_MASK) ^ REVERSE)) {
    relax(run, state, ((x + y * width) << HEADING_BITS) | heading);
  }
};

const expand = (run: Run, state: number) => {
  for (let heading = 0; heading < STEP_X.length; heading += 1) {
    step(run, state, heading);
  }
};

const pathTo = (run: Run, state: number): readonly number[] => {
  const nodes: number[] = [];
  for (let at = state; at !== NONE; at = Number(run.scratch.parent[at])) {
    nodes.push(at >> HEADING_BITS);
  }
  return nodes.toReversed();
};

/**
 * `Walled`: the goal is unreachable and the search never met the window's border, so no wider
 * window can help. `Window`: it may be reachable through a wider window.
 */
export type SearchFailure = "Walled" | "Window";

/** A run with only the start state open. */
const runOf = (spec: SearchSpec): Run => {
  const { lattice, scratch } = spec;
  const goalX = spec.goal % lattice.width;
  prepare(scratch, (lattice.width * lattice.height) << HEADING_BITS);
  const run: Run = {
    spec,
    width: lattice.width,
    goalX,
    goalY: (spec.goal - goalX) / lattice.width,
    scratch,
    generation: scratch.generation,
    heap: { keys: [], states: [], count: 0 },
    reachedBorder: false,
  };
  const first = (spec.start << HEADING_BITS) | spec.startHeading;
  scratch.best[first] = 0;
  scratch.parent[first] = NONE;
  scratch.seen[first] = run.generation;
  push(run.heap, first, 0);
  return run;
};

/** Expands states cheapest first until the goal pops; its state, or `NONE` once none are left. */
const settle = (run: Run): number => {
  const { closed } = run.scratch;
  while (run.heap.keys.length > 0) {
    const state = pop(run.heap);
    if (state >> HEADING_BITS === run.spec.goal) {
      return state;
    }
    if (closed[state] !== run.generation) {
      closed[state] = run.generation;
      expand(run, state);
    }
  }
  return NONE;
};

/**
 * A* over (node, heading) states, Manhattan estimate; ties pop in insertion order, so the result
 * is deterministic. The nodes from start to goal.
 */
export const search = (spec: SearchSpec): Result<readonly number[], SearchFailure> => {
  const run = runOf(spec);
  const goal = settle(run);
  if (goal !== NONE) {
    return ok(pathTo(run, goal));
  }
  return err(run.reachedBorder ? "Window" : "Walled");
};
