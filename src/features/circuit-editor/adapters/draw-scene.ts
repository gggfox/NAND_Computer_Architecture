/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { InstanceId } from "~/shared/ids";

import { SCREEN_PAD } from "../domain/camera";
import type { Camera } from "../domain/camera";
import { GRID } from "../domain/chip-layout";
import type { Size } from "../domain/chip-layout";
import { glowsAt } from "../domain/wire-style";
import { drawOverlays, drawWireHalos } from "./draw-overlays";
import type { OverlayView } from "./draw-overlays";
import { drawChips } from "./draw-parts";
import { drawWires } from "./draw-wires";
import type { Frame, Viewport } from "./frame";
import type { StaticLayer } from "./static-layer";

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

export interface Layers {
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

export const drawScene = (frame: Frame, viewport: Viewport, { view, overlay }: Layers): void => {
  drawBackdrop(frame, viewport, view);
  toWorld(frame.ctx, viewport, view);
  drawWireHalos(frame, overlay);
  drawWires(frame);
  drawChips(frame);
  drawOverlays(frame, overlay, view.zoom);
};

export interface DragLayers extends Layers {
  readonly cached: StaticLayer;
}

/** The cached layer of what stays put, painted when its key changed. */
const stillLayer = (
  frame: Frame,
  viewport: Viewport,
  { view, cached, moved }: DragLayers & { readonly moved: ReadonlySet<InstanceId> },
): HTMLCanvasElement | undefined => {
  const { ctx, palette, known, project, circuit, armed } = frame;
  const zoomBand = glowsAt(view.zoom);
  const key = { ...known, project, circuit, view, viewport, palette, moved, zoomBand, armed };
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
export const drawDragScene = (frame: Frame, viewport: Viewport, layers: DragLayers): void => {
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
