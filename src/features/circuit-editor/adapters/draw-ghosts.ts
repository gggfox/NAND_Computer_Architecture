import type { Point, WireColor } from "~/features/projects";

import { WIRE_WIDTH } from "../domain/wire-style";
import type { WireToken } from "../domain/wire-style";
import { boundsOfPoints } from "./draw-wires";
import { intersects } from "./frame";
import type { Frame } from "./frame";

/** One suggested wire: the route a real one would take, and whether `n` has focused it. */
interface GhostView {
  readonly route: readonly Point[];
  readonly focused: boolean;
}

/** The suggested wires, and the colour a wire accepted now would get (absent: the default). */
export interface GhostsView {
  readonly ghosts?: readonly GhostView[];
  readonly ghostColor?: WireColor;
}

/** What the stroke is blended with. The lowest step that keeps 3:1 in every theme (D17). */
export const GHOST_ALPHA = 0.7;
/** The dash and gap, in screen px; scaled by zoom like the pin guide's. */
const DASH_PX = 6;
/** The focus-ring halo around the focused ghost, the same width as a selected wire's. */
const HALO_WIDTH = 9;

const trace = (ctx: CanvasRenderingContext2D, route: readonly Point[]): void => {
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

const drawHalo = ({ ctx, palette }: Pick<Frame, "ctx" | "palette">, ghost: GhostView): void => {
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  ctx.strokeStyle = palette["focus-ring"];
  ctx.lineWidth = HALO_WIDTH;
  trace(ctx, ghost.route);
};

const drawDashed = (frame: Pick<Frame, "ctx" | "zoom">, ghost: GhostView, ink: string): void => {
  const { ctx, zoom } = frame;
  ctx.globalAlpha = GHOST_ALPHA;
  ctx.setLineDash([DASH_PX / zoom, DASH_PX / zoom]);
  ctx.strokeStyle = ink;
  ctx.lineWidth = WIRE_WIDTH;
  trace(ctx, ghost.route);
};

const resetStroke = (ctx: CanvasRenderingContext2D): void => {
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
};

type GhostFrame = Pick<Frame, "ctx" | "palette" | "zoom" | "visible">;

const onScreen = (frame: GhostFrame, ghosts: readonly GhostView[] = []): readonly GhostView[] =>
  ghosts.filter(
    ({ route }) => route.length > 0 && intersects(boundsOfPoints(route), frame.visible),
  );

/**
 * Suggested wires as translucent dashed strokes in the colour a new wire would get, the focused
 * one on a focus-ring halo. Ghosts off screen are skipped.
 */
export const drawGhosts = (frame: GhostFrame, { ghosts, ghostColor }: GhostsView): void => {
  const shown = onScreen(frame, ghosts);
  if (shown.length === 0) {
    return;
  }
  const token: WireToken = ghostColor === undefined ? "wire" : `wire-${ghostColor}`;
  frame.ctx.lineJoin = "round";
  for (const ghost of shown) {
    if (ghost.focused) {
      drawHalo(frame, ghost);
    }
    drawDashed(frame, ghost, frame.palette[token]);
  }
  resetStroke(frame.ctx);
};
