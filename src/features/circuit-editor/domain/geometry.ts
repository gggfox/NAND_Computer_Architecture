/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { ChipInstance, Circuit, PinKey, Point, Wire } from "~/features/projects";
import type { InstanceId } from "~/shared/ids";

import { GRID, layoutOf, layoutOfKind } from "./chip-layout";
import type { ChipLayout, LayoutCache, LayoutSource, Rect } from "./chip-layout";

export { GRID } from "./chip-layout";
export type { Rect } from "./chip-layout";

export type Part = "nand" | "clock" | "split" | "merge" | "custom" | "input" | "output";

/** The part an instance is; a pin piece is the direction of its pin definition. */
export const partOf = (circuit: Circuit, instance: ChipInstance): Part => {
  const { kind } = instance;
  if (kind.type !== "pin") {
    return kind.type;
  }
  // The schema guarantees the definition; a dangling piece reads as an input.
  return circuit.pins.find((pin) => pin.id === kind.pinId)?.direction ?? "input";
};

/** Everything geometry reads: the open chip, an optional layout cache, and a drag preview. */
export interface Scene extends LayoutSource {
  /** Defaults to an uncached `layoutOf`. */
  readonly layout?: LayoutCache;
  /** Where dragged instances are drawn instead of their stored positions. */
  readonly positions?: ReadonlyMap<InstanceId, Point>;
}

const shifted = (layout: ChipLayout, dx: number, dy: number): ChipLayout => {
  const move = <T extends Point>(item: T): T => ({ ...item, x: item.x + dx, y: item.y + dy });
  return {
    ...layout,
    rect: move(layout.rect),
    pins: layout.pins.map((pin) => ({ ...pin, anchor: move(pin.anchor), tab: move(pin.tab) })),
  };
};

/** An instance's layout in the scene; a dragged instance's cached layout is moved, not rebuilt. */
export const layoutIn = (scene: Scene, instance: ChipInstance): ChipLayout => {
  const layout = (scene.layout ?? layoutOf)(scene, instance);
  const moved = scene.positions?.get(instance.id);
  return moved === undefined
    ? layout
    : shifted(layout, moved.x - instance.position.x, moved.y - instance.position.y);
};

export const rectOf = (scene: Scene, instance: ChipInstance): Rect =>
  layoutIn(scene, instance).rect;

/** Where a pin's wires attach in world space; `undefined` when the instance has no such pin. */
export const pinPosition = (scene: Scene, instance: ChipInstance, pin: PinKey): Point | undefined =>
  layoutIn(scene, instance).pins.find((item) => item.key === pin)?.anchor;

const HALF = 0.5;

type InstanceIndex = ReadonlyMap<InstanceId, ChipInstance>;

/** Instances by id, built once per instances array (edits replace it), so wire ends are O(1). */
const instanceIndexes = new WeakMap<readonly ChipInstance[], InstanceIndex>();

const instanceById = (circuit: Circuit, instanceId: InstanceId): ChipInstance | undefined => {
  const known = instanceIndexes.get(circuit.instances);
  if (known !== undefined) {
    return known.get(instanceId);
  }
  const index: InstanceIndex = new Map(circuit.instances.map((item) => [item.id, item]));
  instanceIndexes.set(circuit.instances, index);
  return index.get(instanceId);
};

const endOf = (scene: Scene, end: Wire["from"]): Point | undefined => {
  const instance = instanceById(scene.circuit, end.instanceId);
  return instance && pinPosition(scene, instance, end.pin);
};

const elbow = (start: Point, end: Point): readonly Point[] => {
  const midX = start.x + (end.x - start.x) * HALF;
  return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
};

/** How far a wire end's instance is drawn from its stored position (0 when it is not dragged). */
const shift = (scene: Scene, end: Wire["from"], axis: "x" | "y"): number => {
  const instance = instanceById(scene.circuit, end.instanceId);
  const moved = scene.positions?.get(end.instanceId);
  return instance === undefined || moved === undefined ? 0 : moved[axis] - instance.position[axis];
};

/** The drag preview of a wire: its stored route, the elbow, or its hand bends moved by a delta. */
type Preview = "stored" | "elbow" | Point;

/** Both ends' shared delta, or the elbow when the ends moved apart (the drop re-routes it). */
const sharedDelta = (scene: Scene, wire: Wire): Preview => {
  const delta = { x: shift(scene, wire.from, "x"), y: shift(scene, wire.from, "y") };
  return delta.x === shift(scene, wire.to, "x") && delta.y === shift(scene, wire.to, "y")
    ? delta
    : "elbow";
};

/**
 * Routing never runs per frame. A wire with one dragged end, or an automatic wire with any, draws
 * the elbow, as do hand bends whose ends are dragged apart; hand bends whose two ends are dragged
 * by the same delta move by it.
 */
const previewOf = (scene: Scene, wire: Wire): Preview => {
  const { positions } = scene;
  if (positions === undefined || positions.size === 0) {
    return "stored";
  }
  const fromMoved = positions.has(wire.from.instanceId);
  const toMoved = positions.has(wire.to.instanceId);
  if (!fromMoved && !toMoved) {
    return "stored";
  }
  return fromMoved && toMoved && wire.manualWaypoints ? sharedDelta(scene, wire) : "elbow";
};

const shiftedBy = (points: readonly Point[], delta: Point): readonly Point[] =>
  points.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y }));

/** The polyline a wire is drawn along: stored waypoints, or an orthogonal elbow between its pins. */
export const wireRoute = (scene: Scene, wire: Wire): readonly Point[] => {
  const start = endOf(scene, wire.from);
  const end = endOf(scene, wire.to);
  if (start === undefined || end === undefined) {
    return [];
  }
  const preview = previewOf(scene, wire);
  if (preview === "elbow" || wire.waypoints.length === 0) {
    return elbow(start, end);
  }
  const waypoints = preview === "stored" ? wire.waypoints : shiftedBy(wire.waypoints, preview);
  return [start, ...waypoints, end];
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
/** Leave the first columns to the inputs; step four grid cells across and three down. */
const FIRST_COLUMN = 160;
const COLUMN_STEP = 160;
const ROW_STEP = 120;

function* candidates(): Generator<Point> {
  for (let row = 0; row < SEARCH_ROWS; row += 1) {
    for (let column = 0; column < SEARCH_COLUMNS; column += 1) {
      yield { x: FIRST_COLUMN + column * COLUMN_STEP, y: row * ROW_STEP };
    }
  }
}

/** The first grid cell (row by row, left to right) where a new NAND touches no existing chip. */
export const freeNandPosition = (scene: Scene): Point => {
  const taken = scene.circuit.instances.map((item) => padded(rectOf(scene, item)));
  for (const point of candidates()) {
    const { rect } = layoutOfKind(scene, { type: "nand" }, point);
    if (!taken.some((other) => overlaps(rect, other))) {
      return point;
    }
  }
  // Every searched cell is full: go below the lowest chip.
  const bottom = Math.max(...taken.map((rect) => rect.y + rect.height));
  return { x: FIRST_COLUMN, y: bottom };
};
