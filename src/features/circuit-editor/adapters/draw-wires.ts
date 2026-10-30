/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Point, Wire } from "~/features/projects";

import type { Rect } from "../domain/chip-layout";
import { wireRoute } from "../domain/geometry";
import { junctions } from "../domain/junctions";
import { signalOf } from "../domain/routing/route";
import { wireLevel } from "../domain/signals";
import { revealDash } from "../domain/wire-reveal";
import { GLOW_ALPHA, GLOW_WIDTH, glowsAt, styleKey, wireStyle } from "../domain/wire-style";
import type { WireStyle, WireToken } from "../domain/wire-style";
import { inPart, intersects } from "./frame";
import type { Frame } from "./frame";

type Route = readonly Point[];

/** A junction dot's radius, world px. */
const JUNCTION_RADIUS = 4;
const FULL_TURN = Math.PI + Math.PI;
const SOLID: readonly number[] = [];

/** Wires stroked together: one style, its settled routes, and every route by signal (for dots). */
interface Batch {
  readonly style: WireStyle;
  readonly routes: Route[];
  readonly signals: Map<string, Route[]>;
}

/** A wire drawing itself in: its route, its style, and how much of it is drawn. */
interface Revealing {
  readonly route: Route;
  readonly style: WireStyle;
  readonly fraction: number;
}

const boundsOfPoints = (points: Route): Rect => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const [x, y] = [Math.min(...xs), Math.min(...ys)];
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

const lengthOf = (route: Route): number => {
  let sum = 0;
  let [previous] = route;
  for (const point of route) {
    sum += previous === undefined ? 0 : Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return sum;
};

/** Adds every route as its own subpath of the current path. */
const trace = (ctx: CanvasRenderingContext2D, routes: readonly Route[]): void => {
  for (const route of routes) {
    for (const [index, point] of route.entries()) {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }
  }
};

/** The route of `wire` when it belongs to this frame's part and is on screen; else empty. */
const visibleRoute = (frame: Frame, wire: Wire): Route => {
  const route = inPart(frame, [wire.from.instanceId, wire.to.instanceId])
    ? wireRoute(frame, wire)
    : [];
  return route.length > 0 && intersects(boundsOfPoints(route), frame.visible) ? route : [];
};

const batchOf = (batches: Map<string, Batch>, style: WireStyle): Batch => {
  const key = styleKey(style);
  const known = batches.get(key);
  if (known !== undefined) {
    return known;
  }
  const batch: Batch = { style, routes: [], signals: new Map() };
  batches.set(key, batch);
  return batch;
};

const addSignal = (batch: Batch, wire: Wire, route: Route): void => {
  const signal = signalOf(wire);
  const routes = batch.signals.get(signal);
  if (routes === undefined) {
    batch.signals.set(signal, [route]);
  } else {
    routes.push(route);
  }
};

interface Gathered {
  readonly batches: Map<string, Batch>;
  readonly revealing: Revealing[];
}

/** Files one visible wire under its style's batch, or with the wires being revealed. */
const addWire = (frame: Frame, gathered: Gathered, wire: Wire): void => {
  const route = visibleRoute(frame, wire);
  if (route.length === 0) {
    return;
  }
  const style = wireStyle({
    color: wire.color,
    level: wireLevel(frame.circuit, frame.known, wire),
  });
  const batch = batchOf(gathered.batches, style);
  addSignal(batch, wire, route);
  const fraction = frame.reveal?.get(wire.id);
  if (fraction === undefined) {
    batch.routes.push(route);
  } else {
    gathered.revealing.push({ route, style, fraction });
  }
};

/** The visible wires, batched by stroke, dash and width (lowest rank first); revealing apart. */
const gather = (frame: Frame): { batches: readonly Batch[]; revealing: readonly Revealing[] } => {
  const gathered: Gathered = { batches: new Map(), revealing: [] };
  for (const wire of frame.circuit.wires) {
    addWire(frame, gathered, wire);
  }
  const batches = [...gathered.batches.values()].toSorted(
    (first, second) => first.style.rank - second.style.rank,
  );
  return { batches, revealing: gathered.revealing };
};

/** One stroked path: every route in it shares colour, width, dash and opacity. */
interface Stroke {
  readonly token: WireToken;
  readonly width: number;
  readonly dash: readonly number[];
  readonly alpha: number;
  readonly routes: readonly Route[];
}

const strokeOf = (style: WireStyle, routes: readonly Route[], dash = style.dash): Stroke => ({
  token: style.token,
  width: style.width,
  dash,
  alpha: 1,
  routes,
});

/** The faint, wide stroke under a high wire. */
const glowOf = (style: WireStyle, routes: readonly Route[], dash = SOLID): Stroke => ({
  token: style.token,
  width: GLOW_WIDTH,
  dash,
  alpha: GLOW_ALPHA,
  routes,
});

/** A new wire drawn along its route up to `fraction`, glow and all; a low wire stays dashed. */
const revealStrokes = ({ route, style, fraction }: Revealing, glow: boolean): Stroke[] => {
  const total = lengthOf(route);
  const dash = revealDash(style.dash, total, fraction);
  const line = strokeOf(style, [route], dash);
  return glow && style.glow ? [glowOf(style, [route], dash), line] : [line];
};

/** Glows first, then one stroke per batch (high on top), then the wires being revealed. */
const strokesOf = (frame: Frame): { strokes: readonly Stroke[]; batches: readonly Batch[] } => {
  const { batches, revealing } = gather(frame);
  const glow = glowsAt(frame.zoom);
  const glows = glow ? batches.filter((batch) => batch.style.glow) : [];
  const strokes = [
    ...glows.map((batch) => glowOf(batch.style, batch.routes)),
    ...batches.map((batch) => strokeOf(batch.style, batch.routes)),
    ...revealing.flatMap((item) => revealStrokes(item, glow)),
  ];
  return { strokes, batches };
};

const strokeOne = (frame: Frame, { token, width, dash, alpha, routes }: Stroke): void => {
  const { ctx } = frame;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = frame.palette[token];
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  trace(ctx, routes);
  ctx.stroke();
};

/** A dot where each shared trunk splits, in that trunk's colour. */
const drawJunctions = (frame: Frame, batches: readonly Batch[]): void => {
  const { ctx, palette } = frame;
  for (const { style, signals } of batches) {
    const dots = junctions(signals);
    if (dots.length > 0) {
      ctx.fillStyle = palette[style.token];
      ctx.beginPath();
      for (const dot of dots) {
        ctx.moveTo(dot.x + JUNCTION_RADIUS, dot.y);
        ctx.arc(dot.x, dot.y, JUNCTION_RADIUS, 0, FULL_TURN);
      }
      ctx.fill();
    }
  }
};

/**
 * Visible wires: glows first, then one stroke per (colour, dash, width) so each style is set
 * once and high wires end on top, then wires being revealed, then the junction dots.
 */
export const drawWires = (frame: Frame): void => {
  const { strokes, batches } = strokesOf(frame);
  const { ctx } = frame;
  ctx.lineJoin = "round";
  for (const stroke of strokes.filter((item) => item.routes.length > 0)) {
    strokeOne(frame, stroke);
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash(SOLID);
  drawJunctions(frame, batches);
};
