import type { InstanceId } from "~/shared/ids";

import type { Camera } from "../domain/camera";
import type { KnownLevels } from "../domain/signals";
import type { Palette, Viewport } from "./frame";

/** Everything the cached part of a drag frame depends on; any change repaints it. */
interface StaticKey extends KnownLevels {
  readonly project: unknown;
  readonly circuit: unknown;
  readonly view: Camera;
  readonly viewport: Viewport;
  readonly palette: Palette;
  readonly moved: ReadonlySet<InstanceId>;
}

const sameSet = (first: ReadonlySet<InstanceId>, second: ReadonlySet<InstanceId>): boolean =>
  first.size === second.size && [...first].every((id) => second.has(id));

const sameView = (first: StaticKey, second: StaticKey): boolean =>
  first.view.zoom === second.view.zoom &&
  first.view.x === second.view.x &&
  first.view.y === second.view.y &&
  first.viewport.width === second.viewport.width &&
  first.viewport.height === second.viewport.height &&
  first.viewport.dpr === second.viewport.dpr;

const sameContent = (first: StaticKey, second: StaticKey): boolean =>
  first.project === second.project &&
  first.circuit === second.circuit &&
  first.inputs === second.inputs &&
  first.outputs === second.outputs &&
  first.levels === second.levels &&
  first.palette === second.palette;

const sameKey = (first: StaticKey, second: StaticKey): boolean =>
  sameView(first, second) && sameContent(first, second) && sameSet(first.moved, second.moved);

type Size = Readonly<Pick<HTMLCanvasElement, "width" | "height">>;
type Paint = (ctx: CanvasRenderingContext2D) => void;

export interface StaticLayer {
  /** The cached layer for `key`, repainted with `paint` only when the key changed. */
  readonly get: (key: StaticKey, size: Size, paint: Paint) => HTMLCanvasElement | undefined;
  /** Drops the cache (the drag ended), so a stale layer is never shown. */
  readonly clear: () => void;
}

interface Cache {
  canvas?: HTMLCanvasElement;
  key?: StaticKey;
}

const repaint = (cache: Cache, size: Size, paint: Paint): HTMLCanvasElement | undefined => {
  cache.canvas ??= document.createElement("canvas");
  const { canvas } = cache;
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return undefined;
  }
  paint(ctx);
  return canvas;
};

/**
 * The part of a drag frame that does not move: backdrop, grid, and every chip and wire away from
 * the moved set, painted once into an offscreen canvas and copied each frame (Phase 2 budget).
 */
export const createStaticLayer = (): StaticLayer => {
  const cache: Cache = {};
  return {
    get: (key, size, paint) => {
      if (cache.canvas !== undefined && cache.key !== undefined && sameKey(cache.key, key)) {
        return cache.canvas;
      }
      delete cache.key;
      const canvas = repaint(cache, size, paint);
      if (canvas !== undefined) {
        cache.key = key;
      }
      return canvas;
    },
    clear: () => {
      delete cache.key;
    },
  };
};
