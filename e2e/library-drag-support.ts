/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Locator, Page } from "@playwright/test";

import { test } from "./support";
import type { ExportedFile, Point } from "./support";

/*
 * Helpers for the library drag specs: mouse drags, real touches through CDP, and the sheet's edge.
 */

/** Past `LONG_PRESS_MS` (400 ms) in `domain/drag-intent.ts`. */
export const LONG_PRESS = 700;
const MOVES = 10;
const HALF = 0.5;
/** How far above the sheet's top edge a drag goes to leave it, in pixels. */
const ABOVE = 24;

export const centreOf = async (target: Locator): Promise<Point> => {
  const box = await target.boundingBox();
  if (box === null) {
    throw new Error("The element is not visible");
  }
  return { x: box.x + box.width * HALF, y: box.y + box.height * HALF };
};

export const between = (from: Point, to: Point, share: number): Point => ({
  x: from.x + (to.x - from.x) * share,
  y: from.y + (to.y - from.y) * share,
});

/** A mouse drag from `from` to `to` in even moves; `beforeRelease` runs with the button still down. */
export const mouseDrag = async (
  page: Page,
  { from, to }: { readonly from: Point; readonly to: Point },
  beforeRelease: () => Promise<void> = async () => {},
): Promise<void> => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let step = 1; step <= MOVES; step += 1) {
    const at = between(from, to, step / MOVES);
    await page.mouse.move(at.x, at.y);
  }
  await beforeRelease();
  await page.mouse.up();
};

/** Real touches through CDP (Chromium only): the synthetic `touch` helper can't drive a list. */
export const cdpTouch = async (page: Page) => {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: "touchStart" | "touchMove" | "touchEnd", at?: Point) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: at === undefined ? [] : [{ x: at.x, y: at.y }],
    });
  return {
    press: (at: Point) => send("touchStart", at),
    move: (at: Point) => send("touchMove", at),
    release: () => send("touchEnd"),
  };
};

/**
 * A finger held past the long-press on `from`, then moved through `via` (if any) to `to`; the
 * caller releases it.
 */
export const longPressDrag = async (
  page: Page,
  path: { readonly from: Point; readonly via?: Point; readonly to: Point },
) => {
  const finger = await cdpTouch(page);
  await finger.press(path.from);
  await page.waitForTimeout(LONG_PRESS);
  const legs =
    path.via === undefined
      ? [[path.from, path.to]]
      : [
          [path.from, path.via],
          [path.via, path.to],
        ];
  for (const [start = path.from, end = path.to] of legs) {
    for (let step = 1; step <= MOVES; step += 1) {
      await finger.move(between(start, end, step / MOVES));
    }
  }
  return finger;
};

/** A point just above the open sheet, over the canvas: a drag there leaves the sheet. */
export const aboveSheet = async (page: Page, x: number): Promise<Point> => {
  const box = await page.locator("[data-sheet]").boundingBox();
  if (box === null) {
    throw new Error("The sheet is not open");
  }
  return { x, y: box.y - ABOVE };
};

/** The open chip "Main"'s draft parts. */
export const mainParts = (
  file: ExportedFile,
): ExportedFile["project"]["chips"][number]["draft"]["instances"] => {
  const main = file.project.chips.find((chip) => chip.name === "Main");
  if (main === undefined) {
    throw new Error("The project has no Main chip");
  }
  return main.draft.instances;
};

export const desktopMouse = ({ isMobile }: { readonly isMobile: boolean }): void => {
  test.skip(isMobile, "Mouse drags run on desktop");
};

export const phoneTouch = ({
  browserName,
  isMobile,
}: {
  readonly browserName: string;
  readonly isMobile: boolean;
}): void => {
  test.skip(!isMobile, "Touch drags run on phones");
  test.skip(
    browserName !== "chromium",
    "Playwright's WebKit can't inject real touches (no CDP); checked by hand on iOS",
  );
};
