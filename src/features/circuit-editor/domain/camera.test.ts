/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import {
  boundsOf,
  cameraForUrl,
  clampZoom,
  fitBounds,
  panBy,
  SCREEN_PAD,
  screenToWorld,
  visibleRect,
  worldToScreen,
  zoomAt,
} from "./camera";
import type { Camera } from "./camera";
import { MAX_ZOOM, MIN_ZOOM } from "./view-search";

const CAMERAS: readonly Camera[] = [
  { zoom: 1, x: 0, y: 0 },
  { zoom: 0.25, x: -300, y: 120 },
  { zoom: 2.5, x: 42.5, y: -7 },
];
const POINTS = [
  { x: 0, y: 0 },
  { x: 375, y: 812 },
  { x: -20, y: 13.5 },
];

describe("camera transforms", () => {
  it("screenToWorld and worldToScreen are inverses", () => {
    for (const camera of CAMERAS) {
      for (const point of POINTS) {
        const back = worldToScreen(camera, screenToWorld(camera, point));
        expect(back.x).toBeCloseTo(point.x);
        expect(back.y).toBeCloseTo(point.y);
      }
    }
  });

  it("puts the camera's world point at the screen padding", () => {
    expect(worldToScreen({ zoom: 2, x: 10, y: 20 }, { x: 10, y: 20 })).toEqual({
      x: SCREEN_PAD,
      y: SCREEN_PAD,
    });
  });

  it("clamps zoom to the URL's range", () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM);
    expect(clampZoom(100)).toBe(MAX_ZOOM);
    expect(clampZoom(1.5)).toBe(1.5);
  });
});

describe("zoomAt and panBy", () => {
  it("zoomAt keeps the world point under the screen point fixed", () => {
    for (const camera of CAMERAS) {
      const screen = { x: 200, y: 150 };
      const before = screenToWorld(camera, screen);
      const zoomed = zoomAt(camera, screen, 1.7);
      const after = screenToWorld(zoomed, screen);
      expect(after.x).toBeCloseTo(before.x);
      expect(after.y).toBeCloseTo(before.y);
    }
  });

  it("zoomAt stops at the zoom limits", () => {
    const start = CAMERAS[0] ?? { zoom: 1, x: 0, y: 0 };
    expect(zoomAt(start, { x: 0, y: 0 }, 100).zoom).toBe(MAX_ZOOM);
    expect(zoomAt(start, { x: 0, y: 0 }, 0.001).zoom).toBe(MIN_ZOOM);
  });

  it("panBy moves content with the finger", () => {
    const camera = { zoom: 2, x: 0, y: 0 };
    const panned = panBy(camera, { x: 40, y: -20 });
    expect(worldToScreen(panned, { x: 0, y: 0 })).toEqual({
      x: SCREEN_PAD + 40,
      y: SCREEN_PAD - 20,
    });
  });
});

describe("boundsOf and fitBounds", () => {
  it("boundsOf unions rects; none gives undefined", () => {
    expect(boundsOf([])).toBeUndefined();
    expect(
      boundsOf([
        { x: 0, y: 10, width: 40, height: 40 },
        { x: -20, y: 30, width: 10, height: 100 },
      ]),
    ).toEqual({ x: -20, y: 10, width: 60, height: 120 });
  });

  it("fitBounds centres the content as large as fits", () => {
    const bounds = { x: 100, y: 100, width: 200, height: 100 };
    const viewport = { width: 496, height: 496 };
    const camera = fitBounds(bounds, viewport);
    expect(camera.zoom).toBeCloseTo(2);
    const centre = worldToScreen(camera, { x: 200, y: 150 });
    expect(centre.x).toBeCloseTo(248);
    expect(centre.y).toBeCloseTo(248);
  });

  it("fitBounds clamps zoom and falls back to the default camera", () => {
    const dot = { x: 0, y: 0, width: 1, height: 1 };
    expect(fitBounds(dot, { width: 800, height: 600 }).zoom).toBe(MAX_ZOOM);
    expect(fitBounds(undefined, { width: 800, height: 600 })).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(fitBounds(dot, { width: 10, height: 10 }).zoom).toBe(1);
  });
});

describe("cameraForUrl", () => {
  it("rounds offsets to hundredths and zoom to thousandths", () => {
    expect(cameraForUrl({ zoom: 1.2346, x: -12.346, y: 0.004 })).toEqual({
      zoom: 1.235,
      x: -12.35,
      y: 0,
    });
  });
});

describe("visibleRect", () => {
  it("is the world rect the viewport shows", () => {
    expect(visibleRect({ zoom: 2, x: 10, y: 20 }, { width: 400, height: 300 })).toEqual({
      x: 10 - SCREEN_PAD / 2,
      y: 20 - SCREEN_PAD / 2,
      width: 200,
      height: 150,
    });
  });
});
