/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Point } from "~/features/projects";

import { centreOn, unionOf } from "./camera";
import type { Camera } from "./camera";
import type { Rect, Size } from "./chip-layout";

/** World to minimap pixels: `world * scale + offset`. */
export interface MinimapTransform {
  readonly scale: number;
  readonly offset: Point;
}

/** Space left around the fitted rect, as a fraction of its size on each side. */
const MARGIN = 0.1;
const HALF = 0.5;

/** Fits the union of the content and the viewport's world rect, centred, with a 10% margin. */
export const minimapTransform = (
  content: Rect | undefined,
  viewportWorld: Rect,
  size: Size,
): MinimapTransform => {
  const union = content === undefined ? viewportWorld : unionOf(content, viewportWorld);
  const spanWidth = Math.max(1, union.width * (1 + MARGIN + MARGIN));
  const spanHeight = Math.max(1, union.height * (1 + MARGIN + MARGIN));
  const scale = Math.min(size.width / spanWidth, size.height / spanHeight);
  const centre = { x: union.x + union.width * HALF, y: union.y + union.height * HALF };
  return {
    scale,
    offset: { x: size.width * HALF - centre.x * scale, y: size.height * HALF - centre.y * scale },
  };
};

export const toMinimap = ({ scale, offset }: MinimapTransform, world: Point): Point => ({
  x: world.x * scale + offset.x,
  y: world.y * scale + offset.y,
});

/** The camera, at its zoom, centred on the world point under `point` on the minimap. */
// oxlint-disable-next-line eslint/max-params -- the specified interface: transform, point, camera and viewport
export const minimapToCamera = (
  { scale, offset }: MinimapTransform,
  point: Point,
  camera: Camera,
  viewport: Size,
): Camera =>
  centreOn(camera, { x: (point.x - offset.x) / scale, y: (point.y - offset.y) / scale }, viewport);
