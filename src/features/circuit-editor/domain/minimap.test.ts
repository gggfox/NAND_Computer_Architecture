/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import type { Point } from "~/features/projects";

import { screenToWorld, visibleRect } from "./camera";
import type { Camera } from "./camera";
import type { Rect, Size } from "./chip-layout";
import { minimapToCamera, minimapTransform, toMinimap } from "./minimap";
import type { MinimapTransform } from "./minimap";

const SIZE: Size = { width: 160, height: 120 };
const VIEWPORT: Size = { width: 800, height: 600 };

const corners = (rect: Rect): readonly Point[] => [
  { x: rect.x, y: rect.y },
  { x: rect.x + rect.width, y: rect.y + rect.height },
];

/** Every corner lands inside the minimap, at least 10% of the fitted span from its edge. */
const expectInside = (transform: MinimapTransform, rect: Rect, span: Size): void => {
  for (const corner of corners(rect)) {
    const point = toMinimap(transform, corner);
    expect(point.x).toBeGreaterThanOrEqual(span.width * transform.scale * 0.1 - 1e-9);
    expect(point.y).toBeGreaterThanOrEqual(span.height * transform.scale * 0.1 - 1e-9);
    expect(point.x).toBeLessThanOrEqual(SIZE.width + 1e-9);
    expect(point.y).toBeLessThanOrEqual(SIZE.height + 1e-9);
  }
};

const expectNear = (point: Point, x: number, y: number): void => {
  expect(point.x).toBeCloseTo(x);
  expect(point.y).toBeCloseTo(y);
};

describe("minimapTransform", () => {
  it("fits the viewport alone, centred with a 10% margin, when there is no content", () => {
    const viewport = { x: 0, y: 0, width: 800, height: 600 };
    const transform = minimapTransform(undefined, viewport, SIZE);
    // 800 x 600 plus 10% each side is 960 x 720; 160 / 960 = 120 / 720.
    expect(transform.scale).toBeCloseTo(1 / 6);
    // The 80 x 60 world margin is 13.33 x 10 minimap pixels.
    expectNear(toMinimap(transform, { x: 0, y: 0 }), 40 / 3, 10);
    expectNear(toMinimap(transform, { x: 400, y: 300 }), 80, 60);
  });

  it("fits the union of the content and the viewport", () => {
    const viewport = { x: 0, y: 0, width: 400, height: 300 };
    const content = { x: -1000, y: 200, width: 600, height: 2000 };
    const transform = minimapTransform(content, viewport, SIZE);
    const union = { width: 1400, height: 2000 };
    // The taller union is limited by height: 120 / (2000 * 1.2).
    expect(transform.scale).toBeCloseTo(0.05);
    expectInside(transform, content, union);
    expectInside(transform, viewport, union);
    // Centred: the union's centre is the minimap's centre.
    expectNear(toMinimap(transform, { x: -300, y: 1100 }), 80, 60);
  });

  it("keeps a finite scale for an empty viewport and no content", () => {
    const transform = minimapTransform(undefined, { x: 5, y: 5, width: 0, height: 0 }, SIZE);
    expect(Number.isFinite(transform.scale)).toBe(true);
    expectNear(toMinimap(transform, { x: 5, y: 5 }), 80, 60);
  });
});

describe("minimapToCamera", () => {
  it("centres the camera on the tapped world point and keeps the zoom", () => {
    const camera: Camera = { zoom: 2, x: 10, y: -20 };
    const content = { x: 0, y: 0, width: 1000, height: 1000 };
    const transform = minimapTransform(content, visibleRect(camera, VIEWPORT), SIZE);
    const target = { x: 750, y: 250 };
    const moved = minimapToCamera(transform, toMinimap(transform, target), camera, VIEWPORT);
    expect(moved.zoom).toBe(2);
    const centre = screenToWorld(moved, { x: 400, y: 300 });
    expect(centre.x).toBeCloseTo(target.x);
    expect(centre.y).toBeCloseTo(target.y);
  });
});
