/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Point } from "~/features/projects";

import { worldToScreen } from "./camera";
import type { Camera } from "./camera";
import type { Rect } from "./chip-layout";
import type { InteractionState } from "./interaction";

/** Screen px between the selection and the bar. */
export const BAR_GAP = 8;
const BAR_HEIGHT = 40;
/** The bar's top edge must stay at least this far from the canvas top, or it goes below. */
export const BAR_MIN_TOP = BAR_HEIGHT + BAR_GAP;
const HALF = 0.5;

/** The bar shows for a selected chip, and only while nothing else has the canvas's attention. */
export const barVisible = (state: InteractionState): boolean =>
  state.selection.instances.size > 0 &&
  state.drag === undefined &&
  state.armed === undefined &&
  state.placing === undefined &&
  state.menu === undefined &&
  state.renaming === undefined &&
  state.arraying === undefined &&
  state.bitPick === undefined;

/** Where the bar's centre edge goes (screen px): above the selection, or below near the canvas top. */
export const barPlacement = (
  bounds: Rect,
  camera: Camera,
): { readonly point: Point; readonly side: "above" | "below" } => {
  const x = bounds.x + bounds.width * HALF;
  const top = worldToScreen(camera, { x, y: bounds.y });
  if (top.y - BAR_GAP >= BAR_MIN_TOP) {
    return { point: { x: top.x, y: top.y - BAR_GAP }, side: "above" };
  }
  const bottom = worldToScreen(camera, { x, y: bounds.y + bounds.height });
  return { point: { x: bottom.x, y: bottom.y + BAR_GAP }, side: "below" };
};
