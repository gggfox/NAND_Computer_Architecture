/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Point } from "~/features/projects";

import type { Rect, Size } from "./chip-layout";
import { MAX_ZOOM, MIN_ZOOM } from "./view-search";
import type { EditorSearch } from "./view-search";

/** What the canvas shows: the world point at the screen's padded top-left corner, and the zoom. */
export type Camera = Pick<EditorSearch, "zoom" | "x" | "y">;

/** Screen padding (CSS px) so chips at world (0, 0) are not glued to the canvas edge. */
export const SCREEN_PAD = 48;
const DEFAULT_CAMERA: Camera = { zoom: 1, x: 0, y: 0 };
const FIT_MARGIN = 48;
const HALF = 0.5;

export const worldToScreen = (camera: Camera, point: Point): Point => ({
  x: SCREEN_PAD + (point.x - camera.x) * camera.zoom,
  y: SCREEN_PAD + (point.y - camera.y) * camera.zoom,
});

export const screenToWorld = (camera: Camera, point: Point): Point => ({
  x: camera.x + (point.x - SCREEN_PAD) / camera.zoom,
  y: camera.y + (point.y - SCREEN_PAD) / camera.zoom,
});

export const clampZoom = (zoom: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** The camera that shows `world` at `screen`, at `zoom`. */
const anchoredAt = (world: Point, screen: Point, zoom: number): Camera => ({
  zoom,
  x: world.x - (screen.x - SCREEN_PAD) / zoom,
  y: world.y - (screen.y - SCREEN_PAD) / zoom,
});

/** Zooms by `factor` (clamped), keeping the world point under `screen` where it is. */
export const zoomAt = (camera: Camera, screen: Point, factor: number): Camera =>
  anchoredAt(screenToWorld(camera, screen), screen, clampZoom(camera.zoom * factor));

/** Moves the content by `delta` screen pixels, as a finger dragging the canvas would. */
export const panBy = (camera: Camera, delta: Point): Camera => ({
  ...camera,
  x: camera.x - delta.x / camera.zoom,
  y: camera.y - delta.y / camera.zoom,
});

/** The smallest rect holding every rect; `undefined` when there are none. */
export const boundsOf = (rects: Iterable<Rect>): Rect | undefined => {
  let bounds: Rect | undefined = undefined;
  for (const rect of rects) {
    if (bounds === undefined) {
      bounds = rect;
    } else {
      const x = Math.min(bounds.x, rect.x);
      const y = Math.min(bounds.y, rect.y);
      const right = Math.max(bounds.x + bounds.width, rect.x + rect.width);
      const bottom = Math.max(bounds.y + bounds.height, rect.y + rect.height);
      bounds = { x, y, width: right - x, height: bottom - y };
    }
  }
  return bounds;
};

/** The screen length left for content once both margins are taken. */
const room = (length: number): number => Math.max(1, length - FIT_MARGIN - FIT_MARGIN);

/** Centres `bounds` in the viewport, as large as fits with a margin; the default camera when empty. */
export const fitBounds = (bounds: Rect | undefined, viewport: Size): Camera => {
  if (bounds === undefined) {
    return DEFAULT_CAMERA;
  }
  const zoom = clampZoom(
    Math.min(room(viewport.width) / bounds.width, room(viewport.height) / bounds.height),
  );
  const centre = { x: bounds.x + bounds.width * HALF, y: bounds.y + bounds.height * HALF };
  return anchoredAt(centre, { x: viewport.width * HALF, y: viewport.height * HALF }, zoom);
};
