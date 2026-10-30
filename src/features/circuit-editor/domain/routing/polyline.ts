/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Point } from "~/features/projects";

import { PIN_CELL } from "../chip-layout";
import type { Rect } from "../chip-layout";
import type { Box } from "./lattice";

const LAST = -1;
const BEFORE_LAST = -2;

/** A world point as the nearest lattice cell. */
export const toCell = (point: Point): Point => ({
  x: Math.round(point.x / PIN_CELL),
  y: Math.round(point.y / PIN_CELL),
});

/** The cells a chip rect covers, edges included. */
export const cellBox = (rect: Rect): Box => ({
  minX: Math.floor(rect.x / PIN_CELL),
  minY: Math.floor(rect.y / PIN_CELL),
  maxX: Math.ceil((rect.x + rect.width) / PIN_CELL),
  maxY: Math.ceil((rect.y + rect.height) / PIN_CELL),
});

export const boxOf = (points: readonly Point[]): Box => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
};

const collinear = (first: Point, middle: Point, last: Point): boolean =>
  (first.x === middle.x && middle.x === last.x) || (first.y === middle.y && middle.y === last.y);

/** Drops repeated points and the middle of every collinear run. */
export const normalised = (points: readonly Point[]): readonly Point[] =>
  points.reduce<Point[]>((kept, point) => {
    const last = kept.at(LAST);
    const before = kept.at(BEFORE_LAST);
    if (last !== undefined && last.x === point.x && last.y === point.y) {
      return kept;
    }
    if (last !== undefined && before !== undefined && collinear(before, last, point)) {
      kept[kept.length - 1] = point;
      return kept;
    }
    kept.push(point);
    return kept;
  }, []);

/** `from` moved one cell (at most the segment) toward `toward`. */
const trimmed = (from: Point, toward: Point): Point => ({
  x: from.x + Math.sign(toward.x - from.x) * Math.min(PIN_CELL, Math.abs(toward.x - from.x)),
  y: from.y + Math.sign(toward.y - from.y) * Math.min(PIN_CELL, Math.abs(toward.y - from.y)),
});

/** The polyline less a one-cell stub at each end; empty when it has no segment. */
export const withoutStubs = (polyline: readonly Point[]): readonly Point[] => {
  const [first, second] = polyline;
  const last = polyline.at(LAST);
  const beforeLast = polyline.at(BEFORE_LAST);
  if (
    first === undefined ||
    second === undefined ||
    last === undefined ||
    beforeLast === undefined
  ) {
    return [];
  }
  return [trimmed(first, second), ...polyline.slice(1, LAST), trimmed(last, beforeLast)];
};

/** Whether a segment's box meets the open inside of `rect` grown by one cell. */
const entersRect = (segment: readonly [Point, Point], rect: Rect): boolean => {
  const [from, to] = segment;
  return (
    Math.min(from.x, to.x) < rect.x + rect.width + PIN_CELL &&
    Math.max(from.x, to.x) > rect.x - PIN_CELL &&
    Math.min(from.y, to.y) < rect.y + rect.height + PIN_CELL &&
    Math.max(from.y, to.y) > rect.y - PIN_CELL
  );
};

/** Whether any segment of the polyline enters any of `rects` grown by one cell. */
export const entersAny = (polyline: readonly Point[], rects: readonly Rect[]): boolean =>
  polyline.some((point, index) => {
    const before = polyline[index - 1];
    return before !== undefined && rects.some((rect) => entersRect([before, point], rect));
  });
