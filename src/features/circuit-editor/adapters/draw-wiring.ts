/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Point, WireColor } from "~/features/projects";
import type { WireId } from "~/shared/ids";

import { bentRoute, moveSegment, routeHandles } from "../domain/bend-geometry";
import { previewToken, WIRE_WIDTH } from "../domain/wire-style";
import type { Frame } from "./frame";

/** A pin waiting for the other end of a wire: where it is and the pins it may reach. */
export interface ArmedView {
  readonly end: Point;
  /** The armed pin's own `pinLevelKey`: it is never dimmed. */
  readonly key: string;
  readonly legal: ReadonlySet<string>;
}

/** A new wire following the pointer, world units, in the armed colour. */
export interface WireDragView {
  readonly from: Point;
  readonly to: Point;
  readonly color?: WireColor;
}

/** Bend mode: the wire, its focused segment, and a segment drag in progress. */
export interface BendsView {
  readonly wireId: WireId;
  readonly segment: number;
  readonly drag?: { readonly index: number; readonly offset: number };
}

const HALF = 0.5;
const FULL_TURN = Math.PI + Math.PI;
/** A 24 px target: the armed ring and the bend handles, in screen pixels. */
const TARGET_RADIUS_PX = 12;
const ARMED_WIDTH_PX = 3;
const HANDLE_WIDTH_PX = 2;
/**
 * The preview dash in screen px, like the marquee's: unlike the low dash, so a wire being drawn
 * never reads as a wire that is off.
 */
const PREVIEW_DASH_ON_PX = 10;
const PREVIEW_DASH_OFF_PX = 6;

const previewDash = (zoom: number): readonly number[] => [
  PREVIEW_DASH_ON_PX / zoom,
  PREVIEW_DASH_OFF_PX / zoom,
];
const SOLID: readonly number[] = [];

const strokeRoute = (ctx: CanvasRenderingContext2D, route: readonly Point[]): void => {
  ctx.beginPath();
  for (const [index, point] of route.entries()) {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  }
  ctx.stroke();
};

const circle = (ctx: CanvasRenderingContext2D, centre: Point, radius: number): void => {
  ctx.beginPath();
  ctx.arc(centre.x, centre.y, radius, 0, FULL_TURN);
};

/** The armed pin's ring: the hover ring's size, drawn thicker so it stays put under hover. */
const drawArmed = (frame: Frame, armed: ArmedView): void => {
  const { ctx, palette, zoom } = frame;
  ctx.strokeStyle = palette["focus-ring"];
  ctx.lineWidth = ARMED_WIDTH_PX / zoom;
  circle(ctx, armed.end, TARGET_RADIUS_PX / zoom);
  ctx.stroke();
};

/** The wire being drawn: a dashed elbow from its pin to the pointer, in the armed colour. */
const drawWireDrag = (frame: Frame, { from, to, color }: WireDragView): void => {
  const { ctx, palette } = frame;
  const midX = from.x + (to.x - from.x) * HALF;
  ctx.strokeStyle = palette[previewToken(color)];
  ctx.lineWidth = WIRE_WIDTH;
  ctx.lineJoin = "round";
  ctx.setLineDash(previewDash(frame.zoom));
  strokeRoute(ctx, [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to]);
  ctx.setLineDash(SOLID);
};

/** The route bend mode shows: the stored one, or the one a segment drag would leave. */
const shownRoute = (frame: Frame, bends: BendsView): readonly Point[] => {
  const route = bentRoute(frame, bends.wireId);
  const [first] = route;
  const last = route.at(-1);
  if (bends.drag === undefined || first === undefined || last === undefined) {
    return route;
  }
  return [first, ...moveSegment(route, bends.drag.index, bends.drag.offset), last];
};

/** A segment drag's route, dashed, so the move shows before it is let go. */
const drawBendPreview = (frame: Frame, route: readonly Point[]): void => {
  const { ctx } = frame;
  ctx.setLineDash(previewDash(frame.zoom));
  strokeRoute(ctx, route);
  ctx.setLineDash(SOLID);
};

/**
 * The handles of `route`: outlined in the focus ring, and the one for segment `focused` filled
 * with it and outlined in the text colour, so it stands out on a selected wire's halo too.
 */
const drawHandles = (frame: Frame, route: readonly Point[], focused: number): void => {
  const { ctx, palette, zoom } = frame;
  for (const handle of routeHandles(route)) {
    const isFocused = handle.index === focused;
    circle(ctx, handle.centre, TARGET_RADIUS_PX / zoom);
    ctx.fillStyle = palette[isFocused ? "focus-ring" : "background"];
    ctx.strokeStyle = palette[isFocused ? "text" : "focus-ring"];
    ctx.fill();
    ctx.stroke();
  }
};

/**
 * A 24 px handle at each interior segment's midpoint. The focused one (keys move it, or it is
 * being dragged) is filled; the rest are outlined. A drag also previews its route, dashed.
 */
const drawBends = (frame: Frame, bends: BendsView): void => {
  const { ctx, palette, zoom } = frame;
  const route = shownRoute(frame, bends);
  ctx.strokeStyle = palette["focus-ring"];
  ctx.lineWidth = HANDLE_WIDTH_PX / zoom;
  if (bends.drag !== undefined) {
    drawBendPreview(frame, route);
  }
  drawHandles(frame, route, bends.drag?.index ?? bends.segment);
};

/** Everything wiring adds over the scene: bend handles, the wire being drawn, the armed ring. */
export const drawWiring = (
  frame: Frame,
  {
    armed,
    wireDrag,
    bends,
  }: {
    readonly armed?: ArmedView;
    readonly wireDrag?: WireDragView;
    readonly bends?: BendsView;
  },
): void => {
  if (bends !== undefined) {
    drawBends(frame, bends);
  }
  if (wireDrag !== undefined) {
    drawWireDrag(frame, wireDrag);
  }
  if (armed !== undefined) {
    drawArmed(frame, armed);
  }
};
