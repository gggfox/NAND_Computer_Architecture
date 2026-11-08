/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Point } from "~/features/projects";

import type { Rect } from "../domain/chip-layout";

/** How chip and pin bodies are drawn: with rounded corners, or with each corner cut at 45°. */
export type CornerStyle = "round" | "bevel";

/** The theme's `--canvas-corners`; any other value draws rounded corners. */
export const toCornerStyle = (value: string): CornerStyle =>
  value.trim() === "bevel" ? "bevel" : "round";

export interface BoxShape {
  readonly corners: CornerStyle;
  /** The corner radius in the round style, world px. */
  readonly radius: number;
  /** How far each corner is cut in the bevel style, world px; 0 gives square corners. */
  readonly bevel: number;
}

const HALF = 0.5;

/** The corners of an octagon: the rectangle with each corner cut by `cut`, clockwise. */
const bevelPoints = (rect: Rect, cut: number): readonly Point[] => {
  const size = Math.min(cut, rect.width * HALF, rect.height * HALF);
  const left = rect.x;
  const top = rect.y;
  const right = left + rect.width;
  const bottom = top + rect.height;
  return [
    { x: left + size, y: top },
    { x: right - size, y: top },
    { x: right, y: top + size },
    { x: right, y: bottom - size },
    { x: right - size, y: bottom },
    { x: left + size, y: bottom },
    { x: left, y: bottom - size },
    { x: left, y: top + size },
  ];
};

const traceBevel = (ctx: CanvasRenderingContext2D, rect: Rect, cut: number): void => {
  const [first, ...rest] = bevelPoints(rect, cut);
  if (first === undefined) {
    return;
  }
  ctx.moveTo(first.x, first.y);
  for (const point of rest) {
    ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
};

/** Adds one body outline to the current path, in the theme's corner style. */
export const traceBox = (ctx: CanvasRenderingContext2D, rect: Rect, shape: BoxShape): void => {
  if (shape.corners === "bevel") {
    traceBevel(ctx, rect, shape.bevel);
    return;
  }
  ctx.roundRect(rect.x, rect.y, rect.width, rect.height, shape.radius);
};
