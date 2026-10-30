/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Point } from "~/features/projects";

import { PIN_CELL } from "./chip-layout";
import { wireRoute } from "./geometry";
import type { Gesture } from "./gesture-types";
import { done, withoutOverlays } from "./interaction";
import type { Drag, InteractionContext, InteractionState, Interpreted } from "./interaction";
import { toWorld } from "./interaction-hits";

type Axis = "x" | "y";
type SegmentDrag = Extract<Drag, { kind: "segment" }>;

/** Half a handle (24 px): how far from a segment's midpoint a press grabs it, in screen px. */
const HANDLE_REACH_PX = 12;
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
  return moved.reduce<readonly Point[]>((out, point) => extend(out, point), []).slice(1, -1);
};

const midpoint = (from: Point, to: Point): Point => ({
  x: from.x + (to.x - from.x) * HALF,
  y: from.y + (to.y - from.y) * HALF,
});

interface Handle {
  readonly index: number;
  readonly axis: Axis;
  readonly away: number;
}

/** The interior segment whose square handle (at its midpoint) holds `point`, nearest first. */
const handleAt = (route: readonly Point[], point: Point, reach: number): Handle | undefined => {
  const segments = segmentsOf(route);
  let best: Handle | undefined = undefined;
  for (const [index, [from, to]] of segments.entries()) {
    const centre = midpoint(from, to);
    const away = Math.max(Math.abs(point.x - centre.x), Math.abs(point.y - centre.y));
    const interior = index > 0 && index < segments.length - 1;
    if (interior && away <= reach && (best === undefined || away < best.away)) {
      best = { index, axis: axisOf(from, to), away };
    }
  }
  return best;
};

const wireIn = (context: InteractionContext, wireId: InteractionState["bends"]) =>
  context.scene.circuit.wires.find((wire) => wire.id === wireId);

/** The handle of the wire in bend mode under `screen`, if any. */
const handleUnder = (
  state: InteractionState,
  screen: Point,
  context: InteractionContext,
): (Handle & { readonly wire: NonNullable<ReturnType<typeof wireIn>> }) | undefined => {
  const wire = state.bends === undefined ? undefined : wireIn(context, state.bends);
  const handle =
    wire &&
    handleAt(
      wireRoute(context.scene, wire),
      toWorld(state, screen),
      HANDLE_REACH_PX / state.camera.zoom,
    );
  return wire && handle && { ...handle, wire };
};

/** The state out of bend mode. */
export const withoutBends = (state: InteractionState): InteractionState => {
  const { bends: _bends, ...rest } = state;
  return rest;
};

/**
 * A tap in bend mode: on a handle it does nothing (`undefined`); anywhere else it leaves bend
 * mode, and the returned state is what the tap then acts on.
 */
export const tappedInBends = (
  state: InteractionState,
  screen: Point,
  context: InteractionContext,
): InteractionState | undefined => {
  if (state.bends === undefined) {
    return state;
  }
  return handleUnder(state, screen, context) === undefined ? withoutBends(state) : undefined;
};

/** A drag from a handle in bend mode moves its segment; else, or with Space, `undefined`. */
export const startSegmentDrag = (
  state: InteractionState,
  gesture: Extract<Gesture, { type: "dragStart" }>,
  context: InteractionContext,
): Interpreted | undefined => {
  const handle = gesture.modifiers.space ? undefined : handleUnder(state, gesture.origin, context);
  if (handle === undefined) {
    return undefined;
  }
  const { hover: _hover, ...rest } = withoutOverlays(state);
  const drag: SegmentDrag = {
    kind: "segment",
    wireId: handle.wire.id,
    index: handle.index,
    axis: handle.axis,
    origin: toWorld(state, gesture.origin),
    offset: 0,
  };
  return done({ ...rest, lassoArmed: false, drag });
};

/** The segment drag following the pointer at `world`. */
export const segmentMoved = (drag: SegmentDrag, world: Point): SegmentDrag => ({
  ...drag,
  offset: world[drag.axis] - drag.origin[drag.axis],
});

const samePoints = (first: readonly Point[], second: readonly Point[]): boolean =>
  first.length === second.length &&
  first.every((point, at) => point.x === second[at]?.x && point.y === second[at]?.y);

/** A segment drag ended: one `moveWaypoint` with the new bends, unless nothing moved. */
export const endSegmentDrag = (
  state: InteractionState,
  drag: SegmentDrag,
  context: InteractionContext,
): Interpreted => {
  const wire = wireIn(context, drag.wireId);
  if (wire === undefined) {
    return done(state);
  }
  const route = wireRoute(context.scene, wire);
  const waypoints = moveSegment(route, drag.index, drag.offset);
  return samePoints(waypoints, route.slice(1, -1))
    ? done(state)
    : done(state, {
        type: "dispatch",
        action: { type: "moveWaypoint", chipId: context.chipId, wireId: wire.id, waypoints },
      });
};
