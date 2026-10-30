/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { ChipInstance, Circuit, Point, Project } from "~/features/projects";
import type { PinId } from "~/shared/ids";

import { GRID, partOf, rectOf, wireRoute } from "../domain/geometry";
import type { Rect, Size } from "../domain/geometry";
import { partName } from "../domain/messages";
import { instanceLevel, wireDash, wireLevel } from "../domain/signals";
import type { KnownLevels, Level } from "../domain/signals";
import type { EditorSearch } from "../domain/view-search";

export interface RenderState extends KnownLevels {
  readonly project: Project;
  readonly circuit: Circuit;
  readonly view: EditorSearch;
}

export interface CanvasRenderer {
  readonly start: () => void;
  readonly stop: () => void;
  /** Schedules one redraw on the next animation frame (coalesced). */
  readonly invalidate: () => void;
}

const TOKENS = [
  "background",
  "surface",
  "text",
  "grid",
  "wire",
  "signal-high",
  "signal-low",
  "chip-nand",
  "chip-text",
  "chip-text-low",
] as const;
type Token = (typeof TOKENS)[number];
type Palette = Readonly<Record<Token, string>>;

/** Theme tokens are CSS custom properties on <html> (ADR 10); the canvas reads the same values. */
const readPalette = (): Palette => {
  const style = getComputedStyle(document.documentElement);
  const entries = TOKENS.map((token) => [token, style.getPropertyValue(`--color-${token}`).trim()]);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- built from the exhaustive TOKENS list above
  return Object.fromEntries(entries) as Palette;
};

/** Screen padding (CSS px) so chips at world (0, 0) are not glued to the canvas edge. */
const PAD = 48;
const WIRE_WIDTH = 3;
const CHIP_RADIUS = 6;
const LABEL_GAP = 8;
const HALF = 0.5;
const FONT = "600 14px system-ui, sans-serif";
const CORNER = 4;
/** Shown on an input or output body before the engine has reported a level. */
const UNKNOWN_LEVEL = "?";

interface Frame {
  readonly ctx: CanvasRenderingContext2D;
  readonly palette: Palette;
  readonly known: KnownLevels;
  readonly project: Project;
  readonly circuit: Circuit;
}

const levelColor = (palette: Palette, level: Level | undefined): string => {
  if (level === undefined) {
    return palette.wire;
  }
  return level === 1 ? palette["signal-high"] : palette["signal-low"];
};

const GRID_DOT = 2;

const drawGrid = (frame: Frame, viewport: Size, view: EditorSearch): void => {
  const { ctx, palette } = frame;
  const step = GRID * view.zoom;
  const offsetX = (PAD - view.x * view.zoom) % step;
  const offsetY = (PAD - view.y * view.zoom) % step;
  ctx.fillStyle = palette.grid;
  for (let x = offsetX; x < viewport.width; x += step) {
    for (let y = offsetY; y < viewport.height; y += step) {
      ctx.fillRect(x - 1, y - 1, GRID_DOT, GRID_DOT);
    }
  }
};

const drawPolyline = (ctx: CanvasRenderingContext2D, points: readonly Point[]): void => {
  ctx.beginPath();
  for (const [index, point] of points.entries()) {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  }
  ctx.stroke();
};

const drawWires = (frame: Frame): void => {
  const { ctx, circuit } = frame;
  ctx.lineWidth = WIRE_WIDTH;
  ctx.lineJoin = "round";
  for (const wire of circuit.wires) {
    const level = wireLevel(circuit, frame.known, wire);
    ctx.strokeStyle = levelColor(frame.palette, level);
    ctx.setLineDash(wireDash(level));
    drawPolyline(ctx, wireRoute(circuit, wire));
  }
  ctx.setLineDash(wireDash());
};

const centerText = (ctx: CanvasRenderingContext2D, text: string, rect: Rect): void => {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, rect.x + rect.width * HALF, rect.y + rect.height * HALF);
};

interface BodyStyle {
  readonly fill: string;
  readonly radius: number;
}

const drawBody = (frame: Frame, rect: Rect, style: BodyStyle): void => {
  const { ctx } = frame;
  ctx.fillStyle = style.fill;
  ctx.strokeStyle = frame.palette.text;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.width, rect.height, style.radius);
  ctx.fill();
  ctx.stroke();
};

/** An input is named A, B, ... by its position among the input pins in Pins-panel order. */
const drawInputName = (frame: Frame, rect: Rect, pinId: PinId): void => {
  const { ctx, circuit } = frame;
  const index = circuit.pins
    .filter((pin) => pin.direction === "input")
    .findIndex((pin) => pin.id === pinId);
  ctx.fillStyle = frame.palette.text;
  ctx.textAlign = "right";
  const letter = String.fromCodePoint("A".codePointAt(0)! + index);
  ctx.fillText(letter, rect.x - LABEL_GAP, rect.y + rect.height * HALF);
};

const bodyStyle = (palette: Palette, isPart: boolean, level: Level | undefined): BodyStyle =>
  isPart
    ? { fill: palette["chip-nand"], radius: CORNER }
    : { fill: levelColor(palette, level), radius: CHIP_RADIUS };

const chipText = (frame: Frame, instance: ChipInstance, level: Level | undefined): string => {
  if (instance.kind.type !== "pin") {
    return partName(frame.project, frame.circuit, instance.kind);
  }
  return level === undefined ? UNKNOWN_LEVEL : String(level);
};

const drawChip = (frame: Frame, instance: ChipInstance): void => {
  const { ctx, palette } = frame;
  const rect = rectOf(instance);
  const { kind } = instance;
  const level = instanceLevel(frame.circuit, frame.known, instance);
  drawBody(frame, rect, bodyStyle(palette, kind.type !== "pin", level));
  ctx.font = FONT;
  ctx.fillStyle = palette[kind.type === "pin" && level === 0 ? "chip-text-low" : "chip-text"];
  centerText(ctx, chipText(frame, instance, level), rect);
  if (kind.type === "pin" && partOf(frame.circuit, instance) === "input") {
    drawInputName(frame, rect, kind.pinId);
  }
};

const drawChips = (frame: Frame): void => {
  for (const instance of frame.circuit.instances) {
    drawChip(frame, instance);
  }
};

interface Viewport extends Size {
  readonly dpr: number;
}

/** Matches the backing store to the element's CSS size times the device pixel ratio. */
const fitBackingStore = (canvas: HTMLCanvasElement): Viewport => {
  const dpr = globalThis.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const backingWidth = Math.round(width * dpr);
  const backingHeight = Math.round(height * dpr);
  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }
  return { width, height, dpr };
};

const drawScene = (frame: Frame, viewport: Viewport, view: EditorSearch): void => {
  const { ctx, palette } = frame;
  const { dpr } = viewport;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  drawGrid(frame, viewport, view);
  const scale = dpr * view.zoom;
  ctx.setTransform(
    scale,
    0,
    0,
    scale,
    (PAD - view.x * view.zoom) * dpr,
    (PAD - view.y * view.zoom) * dpr,
  );
  drawWires(frame);
  drawChips(frame);
};

/**
 * Calls `onChange` on element resize and device-pixel-ratio change, and `onTheme` when <html>'s
 * `data-theme` changes. Returns the function that stops watching.
 */
const watchEnvironment = (
  canvas: HTMLCanvasElement,
  onChange: () => void,
  onTheme: () => void,
): (() => void) => {
  const themeObserver = new MutationObserver(onTheme);
  themeObserver.observe(document.documentElement, { attributeFilter: ["data-theme"] });
  const resizeObserver = new ResizeObserver(onChange);
  resizeObserver.observe(canvas);
  // A query for the current ratio fires once when the ratio changes (browser zoom, another screen).
  let ratioQuery: MediaQueryList | undefined = undefined;
  const watchRatio = (): void => {
    ratioQuery?.removeEventListener("change", onRatio);
    ratioQuery = matchMedia(`(resolution: ${String(globalThis.devicePixelRatio || 1)}dppx)`);
    ratioQuery.addEventListener("change", onRatio);
  };
  function onRatio(): void {
    watchRatio();
    onChange();
  }
  watchRatio();
  return () => {
    themeObserver.disconnect();
    resizeObserver.disconnect();
    ratioQuery?.removeEventListener("change", onRatio);
  };
};

/**
 * Raw Canvas 2D renderer (ADR 20), outside React's render cycle. It draws on the next animation
 * frame only after `invalidate`, a resize, a device-pixel-ratio change or a theme change, and
 * re-reads the theme's `--color-*` tokens on every theme change.
 */
export const createCanvasRenderer = (
  canvas: HTMLCanvasElement,
  read: () => RenderState,
): CanvasRenderer => {
  const ctx = canvas.getContext("2d");
  let palette = readPalette();
  let frameId: number | undefined = undefined;
  let unwatch: (() => void) | undefined = undefined;

  const draw = (): void => {
    frameId = undefined;
    const state = read();
    if (ctx !== null) {
      drawScene(
        { ctx, palette, known: state, project: state.project, circuit: state.circuit },
        fitBackingStore(canvas),
        state.view,
      );
    }
  };
  const invalidate = (): void => {
    if (unwatch !== undefined && frameId === undefined) {
      frameId = requestAnimationFrame(draw);
    }
  };
  const onTheme = (): void => {
    palette = readPalette();
    invalidate();
  };

  return {
    start: () => {
      unwatch ??= watchEnvironment(canvas, invalidate, onTheme);
      onTheme();
    },
    stop: () => {
      unwatch?.();
      unwatch = undefined;
      if (frameId !== undefined) {
        cancelAnimationFrame(frameId);
        frameId = undefined;
      }
    },
    invalidate,
  };
};
