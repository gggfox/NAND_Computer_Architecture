/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Point } from "~/features/projects";

import { layoutIn, wireRoute } from "../domain/geometry";
import type { Hit } from "../domain/hit-test";
import type { Selection } from "../domain/selection";
import { drawGhosts } from "./draw-ghosts";
import type { GhostsView } from "./draw-ghosts";
import { drawPickedPins } from "./draw-picked-pins";
import type { PickedView } from "./draw-picked-pins";
import { drawWiring } from "./draw-wiring";
import type { ArmedView, BendsView, WireDragView } from "./draw-wiring";
import type { Frame } from "./frame";

/** What the interaction layer adds to a frame; every field is optional. */
export interface OverlayView extends PickedView, GhostsView {
  readonly selection?: Selection;
  readonly hover?: Hit;
  /** A box or lasso being drawn, world units. */
  readonly marquee?: { readonly shape: "box" | "lasso"; readonly points: readonly Point[] };
  /** The armed pin; while set, pins outside `legal` are dimmed. */
  readonly armed?: ArmedView;
  /** A new wire being dragged out of a pin. */
  readonly wireDrag?: WireDragView;
  /** Bend mode's wire, focused segment and segment drag. */
  readonly bends?: BendsView;
  /** While a lone pin piece is dragged into line: the x of the column it lines up with. */
  readonly guideX?: number;
}

const SELECTION_GAP = 4;
const SELECTION_WIDTH = 2;
const HALO_WIDTH = 9;
/** The ring around a hovered pin: the 24 px target, in screen pixels. */
const RING_RADIUS_PX = 12;
const MARQUEE_DASH_PX = 6;
const GUIDE_DASH_PX = 4;
const FULL_TURN = Math.PI + Math.PI;

const strokePath = (
  ctx: CanvasRenderingContext2D,
  points: readonly Point[],
  closed: boolean,
): void => {
  ctx.beginPath();
  for (const [index, point] of points.entries()) {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  }
  if (closed) {
    ctx.closePath();
  }
  ctx.stroke();
};

/** A wide halo under each selected wire; drawn before the wires so they stay on top. */
export const drawWireHalos = (frame: Frame, overlay: OverlayView): void => {
  const wires = overlay.selection?.wires;
  if (wires === undefined || wires.size === 0) {
    return;
  }
  const { ctx } = frame;
  ctx.strokeStyle = frame.palette["focus-ring"];
  ctx.lineWidth = HALO_WIDTH;
  ctx.lineJoin = "round";
  for (const wire of frame.circuit.wires) {
    if (wires.has(wire.id)) {
      strokePath(ctx, wireRoute(frame, wire), false);
    }
  }
};

const drawChipOutlines = (frame: Frame, overlay: OverlayView): void => {
  const instances = overlay.selection?.instances;
  if (instances === undefined || instances.size === 0) {
    return;
  }
  const { ctx } = frame;
  ctx.strokeStyle = frame.palette["focus-ring"];
  ctx.lineWidth = SELECTION_WIDTH;
  for (const instance of frame.circuit.instances.filter((item) => instances.has(item.id))) {
    const { x, y, width, height } = layoutIn(frame, instance).rect;
    const gap = SELECTION_GAP;
    ctx.strokeRect(x - gap, y - gap, width + gap + gap, height + gap + gap);
  }
};

const drawHoverRing = (frame: Frame, hover: Hit | undefined, zoom: number): void => {
  if (hover?.type !== "pin") {
    return;
  }
  const { ctx } = frame;
  ctx.strokeStyle = frame.palette["focus-ring"];
  ctx.lineWidth = SELECTION_WIDTH / zoom;
  ctx.beginPath();
  ctx.arc(hover.anchor.x, hover.anchor.y, RING_RADIUS_PX / zoom, 0, FULL_TURN);
  ctx.stroke();
};

const corners = ([first, last]: readonly [Point, Point]): readonly Point[] => [
  first,
  { x: last.x, y: first.y },
  last,
  { x: first.x, y: last.y },
];

const drawMarquee = (frame: Frame, marquee: OverlayView["marquee"], zoom: number): void => {
  const [first] = marquee?.points ?? [];
  const last = marquee?.points.at(-1);
  if (marquee === undefined || first === undefined || last === undefined) {
    return;
  }
  const { ctx } = frame;
  ctx.strokeStyle = frame.palette["focus-ring"];
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([MARQUEE_DASH_PX / zoom, MARQUEE_DASH_PX / zoom]);
  strokePath(ctx, marquee.shape === "box" ? corners([first, last]) : marquee.points, true);
  ctx.setLineDash([]);
};

/** A 1 px dashed vertical line at `x`, the height of the visible world. */
const drawGuide = (frame: Frame, x: number | undefined, zoom: number): void => {
  if (x === undefined) {
    return;
  }
  const { ctx, visible } = frame;
  ctx.strokeStyle = frame.palette["focus-ring"];
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([GUIDE_DASH_PX / zoom, GUIDE_DASH_PX / zoom]);
  strokePath(
    ctx,
    [
      { x, y: visible.y },
      { x, y: visible.y + visible.height },
    ],
    false,
  );
  ctx.setLineDash([]);
};

/** Selection outlines, wiring, the hovered pin's ring, the marquee and the pin guide, on top. */
export const drawOverlays = (frame: Frame, overlay: OverlayView, zoom: number): void => {
  drawChipOutlines(frame, overlay);
  drawWiring(frame, overlay);
  drawGhosts(frame, overlay);
  drawHoverRing(frame, overlay.hover, zoom);
  drawPickedPins(frame, overlay);
  drawMarquee(frame, overlay.marquee, zoom);
  drawGuide(frame, overlay.guideX, zoom);
};
