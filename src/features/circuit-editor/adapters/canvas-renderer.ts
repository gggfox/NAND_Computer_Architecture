/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Circuit, Project } from "~/features/projects";

import { SCREEN_PAD, screenToWorld } from "../domain/camera";
import { createLayoutCache, GRID } from "../domain/chip-layout";
import type { Rect, Size } from "../domain/chip-layout";
import type { KnownLevels } from "../domain/signals";
import type { EditorSearch } from "../domain/view-search";
import { drawChips, drawWires } from "./draw-parts";
import { readPalette } from "./frame";
import type { Frame } from "./frame";
import { watchEnvironment } from "./watch-environment";

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

const GRID_DOT = 2;
/** Below this many screen pixels between dots, only every fourth grid line gets dots. */
const MIN_DOT_SPACING = 8;
const SPARSE_GRID = 4;

const drawGrid = (frame: Frame, viewport: Size, view: EditorSearch): void => {
  const { ctx, palette } = frame;
  const dense = GRID * view.zoom;
  const step = dense < MIN_DOT_SPACING ? dense * SPARSE_GRID : dense;
  const offsetX = (SCREEN_PAD - view.x * view.zoom) % step;
  const offsetY = (SCREEN_PAD - view.y * view.zoom) % step;
  ctx.fillStyle = palette.grid;
  for (let x = offsetX; x < viewport.width; x += step) {
    for (let y = offsetY; y < viewport.height; y += step) {
      ctx.fillRect(x - 1, y - 1, GRID_DOT, GRID_DOT);
    }
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

/** The world rect on screen, so off-screen chips and wires are skipped. */
const visibleWorld = (view: EditorSearch, viewport: Size): Rect => {
  const topLeft = screenToWorld(view, { x: 0, y: 0 });
  return {
    ...topLeft,
    width: viewport.width / view.zoom,
    height: viewport.height / view.zoom,
  };
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
    (SCREEN_PAD - view.x * view.zoom) * dpr,
    (SCREEN_PAD - view.y * view.zoom) * dpr,
  );
  drawWires(frame);
  drawChips(frame);
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
  const layout = createLayoutCache();
  let frameId: number | undefined = undefined;
  let unwatch: (() => void) | undefined = undefined;

  const draw = (): void => {
    frameId = undefined;
    const state = read();
    if (ctx !== null) {
      const viewport = fitBackingStore(canvas);
      const { project, circuit, view } = state;
      const visible = visibleWorld(view, viewport);
      drawScene({ ctx, palette, known: state, project, circuit, layout, visible }, viewport, view);
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
