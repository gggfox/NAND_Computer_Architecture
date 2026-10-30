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
import type { Frame, Palette, Viewport } from "./frame";
import { createStaticLayer } from "./static-layer";
import type { StaticLayer } from "./static-layer";
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

/** Switches to world coordinates for the camera. */
const toWorld = (ctx: CanvasRenderingContext2D, viewport: Viewport, view: Camera): void => {
  const { dpr } = viewport;
  const scale = dpr * view.zoom;
  ctx.setTransform(
    scale,
    0,
    0,
    scale,
    (SCREEN_PAD - view.x * view.zoom) * dpr,
    (SCREEN_PAD - view.y * view.zoom) * dpr,
  );
};

const drawScene = (frame: Frame, viewport: Viewport, { view, overlay }: Layers): void => {
  drawBackdrop(frame, viewport, view);
  toWorld(frame.ctx, viewport, view);
  drawWireHalos(frame, overlay);
  drawWires(frame);
  drawChips(frame);
  drawOverlays(frame, overlay, view.zoom);
};

interface DragLayers extends Layers {
  readonly cached: StaticLayer;
}

/** The cached layer of what stays put, painted when its key changed. */
const stillLayer = (
  frame: Frame,
  viewport: Viewport,
  { view, cached, moved }: DragLayers & { readonly moved: ReadonlySet<InstanceId> },
): HTMLCanvasElement | undefined => {
  const { ctx, palette, known, project, circuit } = frame;
  const key = { ...known, project, circuit, view, viewport, palette, moved };
  return cached.get(key, ctx.canvas, (layerCtx) => {
    const still = { ...frame, ctx: layerCtx, part: { moved, drawMoved: false } };
    drawScene(still, viewport, { view, overlay: {} });
  });
};

/** The moved chips, the wires touching them and the overlays, over the still layer. */
const drawMoving = (moving: Frame, viewport: Viewport, { view, overlay }: Layers): void => {
  toWorld(moving.ctx, viewport, view);
  drawWireHalos(moving, overlay);
  drawWires(moving);
  drawChips(moving);
  drawOverlays(moving, overlay, view.zoom);
};

/**
 * A drag frame: the parts that stay put come from the cached layer (painted once per drag, or
 * when the camera, levels, theme or size change); only the moved chips, the wires touching them
 * and the overlays are drawn again.
 */
const drawDragScene = (frame: Frame, viewport: Viewport, layers: DragLayers): void => {
  const moved = new Set(frame.positions?.keys());
  const layer = stillLayer(frame, viewport, { ...layers, moved });
  if (layer === undefined) {
    drawScene(frame, viewport, layers);
    return;
  }
  frame.ctx.setTransform(1, 0, 0, 1, 0, 0);
  frame.ctx.drawImage(layer, 0, 0);
  drawMoving({ ...frame, part: { moved, drawMoved: true } }, viewport, layers);
};

interface Painter {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly palette: Palette;
  readonly layout: LayoutCache;
  readonly cached: StaticLayer;
}

/** One frame of `state`: the whole scene, or a drag frame over the cached still layer. */
const paint = (painter: Painter, state: RenderState): void => {
  const { canvas, ctx, palette, layout, cached } = painter;
  const viewport = fitBackingStore(canvas);
  const { project, circuit, view, overlay = {} } = state;
  const { positions = new Map<InstanceId, Point>() } = overlay;
  // The world rect on screen, so off-screen chips and wires are skipped.
  const visible = visibleRect(view, viewport);
  const frame = { ctx, palette, known: state, project, circuit, layout, positions, visible };
  if (positions.size === 0) {
    cached.clear();
    drawScene(frame, viewport, { view, overlay });
  } else {
    drawDragScene(frame, viewport, { view, overlay, cached });
  }
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
  const cached = createStaticLayer();

  const draw = (): void => {
    frameId = undefined;
    if (ctx !== null) {
      paint({ canvas, ctx, palette, layout, cached }, read());
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
