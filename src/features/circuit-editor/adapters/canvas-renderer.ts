import type { Point } from "~/features/projects";
import type { InstanceId } from "~/shared/ids";

import { visibleRect } from "../domain/camera";
import { createLayoutCache } from "../domain/chip-layout";
import type { LayoutCache } from "../domain/chip-layout";
import { drawDragScene, drawScene } from "./draw-scene";
import { fitBackingStore, readPalette } from "./frame";
import type { Frame, Palette } from "./frame";
import type { RenderState } from "./render-state";
import { createRevealClock } from "./reveal-clock";
import type { RevealFractions } from "./reveal-clock";
import { createStaticLayer } from "./static-layer";
import type { StaticLayer } from "./static-layer";
import { watchEnvironment } from "./watch-environment";

export interface CanvasRenderer {
  readonly start: () => void;
  readonly stop: () => void;
  /** Schedules one redraw on the next animation frame (coalesced). */
  readonly invalidate: () => void;
}

interface Painter {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly palette: Palette;
  readonly layout: LayoutCache;
  readonly cached: StaticLayer;
  readonly reveal: RevealFractions;
}

/** One frame of `state`: the whole scene, or a drag frame over the cached still layer. */
const paint = (painter: Painter, state: RenderState): void => {
  const { canvas, ctx, palette, layout, cached, reveal } = painter;
  const viewport = fitBackingStore(canvas);
  const { project, circuit, view, overlay = {} } = state;
  const positions = overlay.positions ?? new Map<InstanceId, Point>();
  // The world rect on screen, so off-screen chips and wires are skipped.
  const visible = visibleRect(view, viewport);
  const frame: Frame = {
    ctx,
    palette,
    known: state,
    project,
    circuit,
    layout,
    positions,
    visible,
    reveal,
    zoom: view.zoom,
    ...(overlay.armed === undefined ? {} : { armed: overlay.armed }),
  };
  // A reveal animates wires the still layer would freeze, so it draws whole frames.
  if (positions.size === 0 || reveal.size > 0) {
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
  const clock = createRevealClock();

  const draw = (): void => {
    frameId = undefined;
    if (ctx !== null) {
      const state = read();
      const reveal = clock.tick(state.scope, state.circuit.wires);
      paint({ canvas, ctx, palette, layout, cached, reveal }, state);
      // One rAF loop until every reveal is done.
      if (clock.running()) {
        invalidate();
      }
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
