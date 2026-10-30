/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { ChipInstance, Circuit, Point, Project } from "~/features/projects";
import type { InstanceId } from "~/shared/ids";

import { boundsOf, visibleRect } from "../domain/camera";
import type { Camera } from "../domain/camera";
import type { LayoutCache, Rect, Size } from "../domain/chip-layout";
import { layoutIn } from "../domain/geometry";
import { minimapToCamera, minimapTransform, toMinimap } from "../domain/minimap";
import type { MinimapTransform } from "../domain/minimap";
import { fitBackingStore, readPalette } from "./frame";
import type { Palette } from "./frame";
import { watchEnvironment } from "./watch-environment";

export interface MinimapState {
  readonly project: Project;
  readonly circuit: Circuit;
  readonly layout: LayoutCache;
  /** Where dragged chips are drawn instead of their stored positions. */
  readonly positions: ReadonlyMap<InstanceId, Point>;
  readonly view: Camera;
  /** The main canvas's size in CSS pixels. */
  readonly viewport: Size;
  /** A drag is in progress on the main canvas: redraw only every other frame. */
  readonly dragging: boolean;
}

interface MinimapDeps {
  readonly read: () => MinimapState;
  /** A tap or drag on the minimap moved the camera; `settle` ends the gesture. */
  readonly jump: (camera: Camera, settle: boolean) => void;
}

interface Minimap {
  readonly start: () => void;
  readonly stop: () => void;
  /** Schedules one redraw on a coming animation frame (coalesced). */
  readonly invalidate: () => void;
}

const OUTLINE_WIDTH = 2;

const chipRects = (state: MinimapState): readonly Rect[] =>
  state.circuit.instances.map((instance) => layoutIn(state, instance).rect);

const transformOf = (state: MinimapState, rects: readonly Rect[], size: Size): MinimapTransform =>
  minimapTransform(boundsOf(rects), visibleRect(state.view, state.viewport), size);

const mapped = (transform: MinimapTransform, rect: Rect): Rect => ({
  ...toMinimap(transform, rect),
  width: rect.width * transform.scale,
  height: rect.height * transform.scale,
});

/** A pin piece in the wire colour; a part in its custom colour, else the NAND colour. */
const fillOf = (state: MinimapState, palette: Palette, instance: ChipInstance): string => {
  const { kind } = instance;
  if (kind.type === "pin") {
    return palette.wire;
  }
  const custom =
    kind.type === "custom"
      ? state.project.chips.find((chip) => chip.id === kind.chipId)
      : undefined;
  return custom?.color ?? palette["chip-nand"];
};

/** Chip rects in their colours (no labels), then the viewport outline in the selection colour. */
const paint = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, palette: Palette) => {
  const { width, height, dpr } = fitBackingStore(canvas);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = palette.surface;
  ctx.fillRect(0, 0, width, height);
  return (state: MinimapState): void => {
    const chips = state.circuit.instances.map((instance) => ({
      rect: layoutIn(state, instance).rect,
      fill: fillOf(state, palette, instance),
    }));
    const transform = transformOf(
      state,
      chips.map((chip) => chip.rect),
      { width, height },
    );
    for (const chip of chips) {
      const rect = mapped(transform, chip.rect);
      ctx.fillStyle = chip.fill;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
    // The focus-ring token is the canvas's selection colour, contrast-tested in every theme.
    const view = mapped(transform, visibleRect(state.view, state.viewport));
    ctx.strokeStyle = palette["focus-ring"];
    ctx.lineWidth = OUTLINE_WIDTH;
    ctx.strokeRect(view.x, view.y, view.width, view.height);
  };
};

const localPoint = (canvas: HTMLCanvasElement, event: PointerEvent): Point => {
  const box = canvas.getBoundingClientRect();
  return {
    x: event.clientX - box.left - canvas.clientLeft,
    y: event.clientY - box.top - canvas.clientTop,
  };
};

type PointerType =
  | "pointerdown"
  | "pointermove"
  | "pointerup"
  | "pointercancel"
  | "lostpointercapture";
const POINTER_TYPES: readonly PointerType[] = [
  "pointerdown",
  "pointermove",
  "pointerup",
  "pointercancel",
  "lostpointercapture",
];
type Listeners = Readonly<Record<PointerType, (event: PointerEvent) => void>>;

const listen = (canvas: HTMLCanvasElement, listeners: Listeners): (() => void) => {
  for (const type of POINTER_TYPES) {
    canvas.addEventListener(type, listeners[type]);
  }
  return () => {
    for (const type of POINTER_TYPES) {
      canvas.removeEventListener(type, listeners[type]);
    }
  };
};

/**
 * Tap or drag to centre the camera there, instantly (never animated). The transform is frozen
 * while the pointer is down, so the map does not slide under the finger as the outline moves.
 */
const attachInput = (
  canvas: HTMLCanvasElement,
  deps: MinimapDeps,
  onDrag: (active: boolean) => void,
): (() => void) => {
  let frozen: MinimapTransform | undefined = undefined;
  const jump = (event: PointerEvent, settle: boolean): void => {
    if (frozen !== undefined) {
      const { view, viewport } = deps.read();
      deps.jump(minimapToCamera(frozen, localPoint(canvas, event), view, viewport), settle);
    }
  };
  const end = (event: PointerEvent): void => {
    jump(event, true);
    frozen = undefined;
    onDrag(false);
  };
  const onDown = (event: PointerEvent): void => {
    if (event.button === 0) {
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      const state = deps.read();
      const size = { width: canvas.clientWidth, height: canvas.clientHeight };
      frozen = transformOf(state, chipRects(state), size);
      onDrag(true);
      jump(event, false);
    }
  };
  const onMove = (event: PointerEvent): void => {
    jump(event, false);
  };
  // A cancelled drag keeps the camera it reached; it still settles the URL.
  return listen(canvas, {
    pointerdown: onDown,
    pointermove: onMove,
    pointerup: end,
    pointercancel: end,
    lostpointercapture: end,
  });
};

/** Coalesced redraws; while `busy`, every draw waits one extra frame (every other frame). */
interface Scheduler {
  readonly schedule: () => void;
  readonly cancel: () => void;
}

const createScheduler = (draw: () => void, busy: () => boolean): Scheduler => {
  let frameId: number | undefined = undefined;
  let skipped = false;
  const run = (): void => {
    frameId = undefined;
    if (busy() && !skipped) {
      skipped = true;
      frameId = requestAnimationFrame(run);
      return;
    }
    skipped = false;
    draw();
  };
  return {
    schedule: () => {
      frameId ??= requestAnimationFrame(run);
    },
    cancel: () => {
      if (frameId !== undefined) {
        cancelAnimationFrame(frameId);
        frameId = undefined;
      }
    },
  };
};

/**
 * The minimap (spec §5.1): chip rects and the viewport outline, drawn on the same invalidations
 * as the main canvas but only every other frame while anything is dragged. Nothing is drawn while
 * the element is hidden (a canvas narrower than 360 px).
 */
export const createMinimap = (canvas: HTMLCanvasElement, deps: MinimapDeps): Minimap => {
  const ctx = canvas.getContext("2d");
  let palette = readPalette();
  let ownDrag = false;
  let detach: (() => void) | undefined = undefined;
  const scheduler = createScheduler(
    () => {
      if (ctx !== null && canvas.clientWidth > 0) {
        paint(canvas, ctx, palette)(deps.read());
      }
    },
    () => ownDrag || deps.read().dragging,
  );
  const invalidate = (): void => {
    if (detach !== undefined) {
      scheduler.schedule();
    }
  };
  const onTheme = (): void => {
    palette = readPalette();
    invalidate();
  };
  const attach = (): (() => void) => {
    const unwatch = watchEnvironment(canvas, invalidate, onTheme);
    const detachInput = attachInput(canvas, deps, (active) => {
      ownDrag = active;
    });
    return () => {
      unwatch();
      detachInput();
    };
  };
  return {
    start: () => {
      detach ??= attach();
      onTheme();
    },
    stop: () => {
      detach?.();
      detach = undefined;
      scheduler.cancel();
    },
    invalidate,
  };
};
