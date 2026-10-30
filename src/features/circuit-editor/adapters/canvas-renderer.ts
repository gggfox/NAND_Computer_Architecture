/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Circuit, Point, Project } from "~/features/projects";
import type { InstanceId } from "~/shared/ids";

import { SCREEN_PAD, visibleRect } from "../domain/camera";
import type { Camera } from "../domain/camera";
import { createLayoutCache, GRID } from "../domain/chip-layout";
import type { LayoutCache, Size } from "../domain/chip-layout";
import type { KnownLevels } from "../domain/signals";
import { drawOverlays, drawWireHalos } from "./draw-overlays";
import type { OverlayView } from "./draw-overlays";
import { drawChips, drawWires } from "./draw-parts";
import { fitBackingStore, readPalette } from "./frame";
import type { Frame, Viewport } from "./frame";
import { watchEnvironment } from "./watch-environment";

export interface RenderState extends KnownLevels {
  /** The interaction layer: selection, hover, marquee, and the drag preview's positions. */
  readonly overlay?: OverlayView & { readonly positions?: ReadonlyMap<InstanceId, Point> };
  readonly project: Project;
  readonly circuit: Circuit;
  readonly view: Camera;
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

const drawGrid = (frame: Frame, viewport: Size, view: Camera): void => {
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

interface Layers {
  readonly view: Camera;
  readonly overlay: OverlayView;
}

/** Clears to the background and draws the grid, in screen space. */
const drawBackdrop = (frame: Frame, viewport: Viewport, view: Camera): void => {
  const { ctx, palette } = frame;
  const { dpr } = viewport;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  drawGrid(frame, viewport, view);
};

const drawScene = (frame: Frame, viewport: Viewport, { view, overlay }: Layers): void => {
  drawBackdrop(frame, viewport, view);
  const { dpr } = viewport;
  const scale = dpr * view.zoom;
  frame.ctx.setTransform(
    scale,
    0,
    0,
    scale,
    (SCREEN_PAD - view.x * view.zoom) * dpr,
    (SCREEN_PAD - view.y * view.zoom) * dpr,
  );
  drawWireHalos(frame, overlay);
  drawWires(frame);
  drawChips(frame);
  drawOverlays(frame, overlay, view.zoom);
};

/**
 * Raw Canvas 2D renderer (ADR 20), outside React's render cycle. It draws on the next animation
 * frame only after `invalidate`, a resize, a device-pixel-ratio change or a theme change, and
 * re-reads the theme's `--color-*` tokens on every theme change.
 */
export const createCanvasRenderer = (
  canvas: HTMLCanvasElement,
  read: () => RenderState,
  layout: LayoutCache = createLayoutCache(),
): CanvasRenderer => {
  const ctx = canvas.getContext("2d");
  let palette = readPalette();
  let frameId: number | undefined = undefined;
  let unwatch: (() => void) | undefined = undefined;

  const draw = (): void => {
    frameId = undefined;
    const state = read();
    if (ctx !== null) {
      const viewport = fitBackingStore(canvas);
      const { project, circuit, view } = state;
      // The world rect on screen, so off-screen chips and wires are skipped.
      const visible = visibleRect(view, viewport);
      const overlay = state.overlay ?? {};
      const positions = overlay.positions ?? new Map();
      const frame = { ctx, palette, known: state, project, circuit, layout, visible, positions };
      drawScene(frame, viewport, { view, overlay });
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
