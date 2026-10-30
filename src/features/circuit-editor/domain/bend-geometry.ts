/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Point } from "~/features/projects";
import type { WireId } from "~/shared/ids";

import { PIN_CELL } from "./chip-layout";
import { wireRoute } from "./geometry";
import type { Scene } from "./geometry";

type Axis = "x" | "y";

const HALF = 0.5;

/** The axis a segment moves along: across itself. A segment along x moves along y. */
const axisOf = (from: Point, to: Point): Axis => (from.y === to.y && from.x !== to.x ? "y" : "x");

const snap = (value: number): number => Math.round(value / PIN_CELL) * PIN_CELL;

const placed = (point: Point, axis: Axis, value: number): Point =>
  axis === "x" ? { x: value, y: point.y } : { x: point.x, y: value };

/**
 * Keeps `value` at least one cell out from `pin` when the stub from `pin` to `toward` runs along
 * `axis`, so a moved segment never folds back over a stub.
 */
const outsideStub = (
  value: number,
  { pin, toward, axis }: { readonly pin: Point; readonly toward: Point; readonly axis: Axis },
): number => {
  const side = Math.sign(toward[axis] - pin[axis]);
  const limit = pin[axis] + side * PIN_CELL;
  return side !== 0 && (value - limit) * side < 0 ? limit : value;
};

type Segment = readonly [Point, Point];

/** Each consecutive pair of points on a route. */
const segmentsOf = (route: readonly Point[]): readonly Segment[] => {
  const segments: Segment[] = [];
  let previous: Point | undefined = undefined;
  for (const point of route) {
    if (previous !== undefined) {
      segments.push([previous, point]);
    }
    previous = point;
  }
  return segments;
};

/** `value` for interior segment `index` of `segments`, held clear of each stub it meets. */
const clamped = (
  segments: readonly Segment[],
  { index, axis, value }: { readonly index: number; readonly axis: Axis; readonly value: number },
): number => {
  const [first] = segments;
  const last = segments.at(-1);
  const afterFirst =
    index === 1 && first ? outsideStub(value, { pin: first[0], toward: first[1], axis }) : value;
  return last !== undefined && segments[index + 1] === last
    ? outsideStub(afterFirst, { pin: last[1], toward: last[0], axis })
    : afterFirst;
};

const collinear = (first: Point, middle: Point, last: Point): boolean =>
  (first.x === middle.x && middle.x === last.x) || (first.y === middle.y && middle.y === last.y);

/** `out` followed by `point`, without a repeat or a corner left that does not turn (or spikes). */
const extend = (out: readonly Point[], point: Point): readonly Point[] => {
  const top = out.at(-1);
  if (top === undefined) {
    return [point];
  }
  const rest = out.slice(0, -1);
  const before = rest.at(-1);
  if (before !== undefined && collinear(before, top, point)) {
    return extend(rest, point);
  }
  return top.x === point.x && top.y === point.y ? out : [...out, point];
};

const length = (from: Point, to: Point): number =>
  Math.abs(to.x - from.x) + Math.abs(to.y - from.y);

/**
 * The stub `after` (pin first) still leaves the pin the way `before` did, at least as far, up to
 * one cell: a moved segment must not fold a stub back through its own chip.
 */
const stubKept = (before: Segment | undefined, after: Segment | undefined): boolean => {
  if (before === undefined || after === undefined) {
    return before === after;
  }
  const [pin, out] = before;
  const [, next] = after;
  if (length(pin, out) === 0) {
    // A zero-length stub has no way out to keep.
    return true;
  }
  const sameWay =
    Math.sign(next.x - pin.x) === Math.sign(out.x - pin.x) &&
    Math.sign(next.y - pin.y) === Math.sign(out.y - pin.y);
  return sameWay && length(pin, next) >= Math.min(length(pin, out), PIN_CELL);
};

/** Both stubs of `full` survive from `route`: the first from its start, the last from its end. */
const stubsKept = (route: readonly Point[], full: readonly Point[]): boolean =>
  stubKept(segmentsOf(route)[0], segmentsOf(full)[0]) &&
  stubKept(segmentsOf(route.toReversed())[0], segmentsOf(full.toReversed())[0]);

interface Planned {
  readonly from: Point;
  readonly to: Point;
  readonly axis: Axis;
  readonly value: number;
}

/** Where interior segment `index` goes, snapped and clamped; `undefined` when it stays. */
const planned = (
  segments: readonly Segment[],
  index: number,
  offset: number,
): Planned | undefined => {
  const segment = index >= 1 && index < segments.length - 1 ? segments[index] : undefined;
  if (segment === undefined) {
    return undefined;
  }
  const [from, to] = segment;
  const axis = axisOf(from, to);
  const value = clamped(segments, { index, axis, value: snap(from[axis] + offset) });
  return value === from[axis] && value === to[axis] ? undefined : { from, to, axis, value };
};

/**
 * Moves interior segment `index` of `route` (full polyline) perpendicular by `offset` world px,
 * snapped to `PIN_CELL`; returns new interior waypoints. Stubs (first, last segment) never move.
 * The segment's ends gain corners to its old neighbours, so every angle stays a right angle, and
 * points left collinear are merged away.
 */
export const moveSegment = (
  route: readonly Point[],
  index: number,
  offset: number,
): readonly Point[] => {
  const move = planned(segmentsOf(route), index, offset);
  if (move === undefined) {
    return route.slice(1, -1);
  }
  const { from, to, axis, value } = move;
  const moved = [
    ...route.slice(0, index + 1),
    placed(from, axis, value),
    placed(to, axis, value),
    ...route.slice(index + 1),
  ];
  const full = moved.reduce<readonly Point[]>((out, point) => extend(out, point), []);
  return stubsKept(route, full) ? full.slice(1, -1) : route.slice(1, -1);
};

const midpoint = (from: Point, to: Point): Point => ({
  x: from.x + (to.x - from.x) * HALF,
  y: from.y + (to.y - from.y) * HALF,
});

/** A bend handle: interior segment `index` of a wire's route, drawn at `centre`, moving along `axis`. */
export interface BendHandle {
  readonly index: number;
  readonly centre: Point;
  readonly axis: Axis;
}

/** The handles of a route: one per interior segment, in route order (also a drag preview's). */
export const routeHandles = (route: readonly Point[]): readonly BendHandle[] =>
  segmentsOf(route)
    .slice(1, -1)
    .map(([from, to], at) => ({
      index: at + 1,
      centre: midpoint(from, to),
      axis: axisOf(from, to),
    }));

/** The route of wire `wireId` as drawn; empty when the wire is gone. */
export const bentRoute = (scene: Scene, wireId: WireId): readonly Point[] => {
  const wire = scene.circuit.wires.find((item) => item.id === wireId);
  return wire === undefined ? [] : wireRoute(scene, wire);
};

/**
 * The handles bend mode draws for wire `wireId`: one 24 px handle at the midpoint of each interior
 * segment (stubs have none), in route order. For the renderer and the bend interactions.
 */
export const bendHandles = (scene: Scene, wireId: WireId): readonly BendHandle[] =>
  routeHandles(bentRoute(scene, wireId));

/** The handle whose square (half-side `reach`) holds `point`, nearest first. */
export const handleAt = (
  handles: readonly BendHandle[],
  point: Point,
  reach: number,
): BendHandle | undefined => {
  let best: { readonly handle: BendHandle; readonly away: number } | undefined = undefined;
  for (const handle of handles) {
    const { centre } = handle;
    const away = Math.max(Math.abs(point.x - centre.x), Math.abs(point.y - centre.y));
    if (away <= reach && (best === undefined || away < best.away)) {
      best = { handle, away };
    }
  }
  return best?.handle;
};
