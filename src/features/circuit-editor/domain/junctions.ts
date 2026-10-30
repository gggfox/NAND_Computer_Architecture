import type { Point } from "~/features/projects";

type Segment = readonly [Point, Point];

/** Junctions need at least this many route directions meeting at one point. */
const MIN_DIRECTIONS = 3;
/** A trunk is shared by two or more routes; one route alone never splits. */
const MIN_ROUTES = 2;

const keyOf = (point: Point): string => `${String(point.x)},${String(point.y)}`;

/** The way from `from` toward `to`, by sign on each axis. */
const direction = (from: Point, to: Point): string =>
  `${String(Math.sign(to.x - from.x))},${String(Math.sign(to.y - from.y))}`;

const same = (first: Point, second: Point): boolean => first.x === second.x && first.y === second.y;

/** Whether `point` lies on segment `[from, to]`, strictly between its ends. */
const inside = (point: Point, [from, to]: Segment): boolean => {
  const cross = (to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x);
  const dot = (point.x - from.x) * (to.x - from.x) + (point.y - from.y) * (to.y - from.y);
  const length = (to.x - from.x) * (to.x - from.x) + (to.y - from.y) * (to.y - from.y);
  return cross === 0 && dot > 0 && dot < length;
};

/** The directions segment `[from, to]` leaves `point` in: one from an end, two from inside. */
const directionsAt = (point: Point, segment: Segment): readonly string[] => {
  const [from, to] = segment;
  if (same(point, from)) {
    return [direction(from, to)];
  }
  if (same(point, to)) {
    return [direction(to, from)];
  }
  return inside(point, segment) ? [direction(point, from), direction(point, to)] : [];
};

/** Every segment of `routes` with length, in order. */
const segmentsOf = (routes: readonly (readonly Point[])[]): readonly Segment[] =>
  routes.flatMap((route) =>
    route.slice(1).flatMap((to, at): Segment[] => {
      const from = route[at];
      return from === undefined || same(from, to) ? [] : [[from, to]];
    }),
  );

/** The junctions of one signal's routes: each corner or end where three or more ways meet. */
const signalJunctions = (routes: readonly (readonly Point[])[]): readonly Point[] => {
  const segments = segmentsOf(routes);
  const candidates = new Map(segments.flat().map((point) => [keyOf(point), point]));
  return [...candidates.values()].filter((point) => {
    const ways = new Set(segments.flatMap((segment) => directionsAt(point, segment)));
    return ways.size >= MIN_DIRECTIONS;
  });
};

/**
 * Points where three or more route directions of one signal meet: where a shared trunk splits.
 * Routes of different signals never form a junction, and a lone route has none (it never splits).
 */
export const junctions = (
  routes: ReadonlyMap<string, readonly (readonly Point[])[]>,
): readonly Point[] =>
  [...routes.values()].flatMap((signal) =>
    signal.length < MIN_ROUTES ? [] : signalJunctions(signal),
  );
