import type { Point } from "~/features/projects";

import type { Frame } from "./frame";

/** The pin-selection overlay: picked pins with their order, and the pin a refusal blames. */
export interface PickedView {
  /** The selected pins' anchors, with the 1-based order they were picked in. */
  readonly picked?: readonly { readonly at: Point; readonly order: number }[];
  /** The pin a refused bulk wire blames. */
  readonly refusedAt?: Point;
}

/** All the painting needs: the canvas, the colours and the zoom. */
export type PaintFrame = Pick<Frame, "ctx" | "palette" | "zoom">;

const RING_RADIUS_PX = 12;
const REFUSED_RADIUS_PX = 16;
const RING_WIDTH_PX = 2;
const REFUSED_WIDTH_PX = 3;
/** The number is this many px at zoom 1; it shrinks with the canvas and hides below the minimum. */
const NUMBER_PX = 14;
const MIN_NUMBER_PX = 10;
const NUMBER_OFFSET_PX = 4;
const HALF = 0.5;
const FULL_TURN = Math.PI + Math.PI;

const ring = (frame: PaintFrame, at: Point, radiusPx: number): void => {
  const { ctx, zoom } = frame;
  ctx.beginPath();
  ctx.arc(at.x, at.y, radiusPx / zoom, 0, FULL_TURN);
  ctx.stroke();
};

const drawNumber = (frame: PaintFrame, at: Point, order: number): void => {
  const { ctx, zoom } = frame;
  const sizePx = NUMBER_PX * Math.min(zoom, 1);
  if (sizePx < MIN_NUMBER_PX) {
    return;
  }
  ctx.fillStyle = frame.palette.text;
  ctx.font = `bold ${sizePx / zoom}px sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  const gap = (RING_RADIUS_PX + NUMBER_OFFSET_PX) / zoom;
  ctx.fillText(String(order), at.x + gap, at.y - gap * HALF);
};

const drawPicked = (frame: PaintFrame, picked: NonNullable<PickedView["picked"]>): void => {
  const { ctx, zoom } = frame;
  ctx.strokeStyle = frame.palette["focus-ring"];
  ctx.lineWidth = RING_WIDTH_PX / zoom;
  for (const { at } of picked) {
    ring(frame, at, RING_RADIUS_PX);
  }
  for (const { at, order } of picked) {
    drawNumber(frame, at, order);
  }
};

const drawRefused = (frame: PaintFrame, at: Point): void => {
  frame.ctx.strokeStyle = frame.palette["wire-red"];
  frame.ctx.lineWidth = REFUSED_WIDTH_PX / frame.zoom;
  ring(frame, at, REFUSED_RADIUS_PX);
};

/** A ring and an order number on each selected pin; a warning ring on the one a refusal blames. */
export const drawPickedPins = (frame: PaintFrame, view: PickedView): void => {
  if (view.picked !== undefined) {
    drawPicked(frame, view.picked);
  }
  if (view.refusedAt !== undefined) {
    drawRefused(frame, view.refusedAt);
  }
};
