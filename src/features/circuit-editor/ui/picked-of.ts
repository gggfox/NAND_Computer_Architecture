import type { PinRef, Point } from "~/features/projects";

import type { OverlayView } from "../adapters/draw-overlays";
import { pinPosition } from "../domain/geometry";
import type { Scene } from "../domain/geometry";
import type { Notice, Selection } from "../domain/selection";

type Picked = Pick<OverlayView, "picked" | "refusedAt">;

const anchorOf = (scene: Scene, { instanceId, pin }: PinRef): Point | undefined => {
  const instance = scene.circuit.instances.find((item) => item.id === instanceId);
  return instance && pinPosition(scene, instance, pin);
};

/** Only a refused bulk wire names the pin to blame; a plain connection error has none. */
const blamedPin = (notice: Notice | undefined): PinRef | undefined =>
  notice !== undefined && "at" in notice ? notice.at : undefined;

/**
 * The selected pins' anchors with their 1-based order, and the refused pin's anchor. A pin whose
 * chip or pin is gone is skipped, but the others keep the numbers they were picked with.
 */
export const pickedOf = (
  scene: Scene,
  state: { readonly selection: Selection; readonly notice?: Notice },
): Picked => {
  const picked = state.selection.pins.flatMap((pin, index) => {
    const at = anchorOf(scene, pin);
    return at === undefined ? [] : [{ at, order: index + 1 }];
  });
  const blamed = blamedPin(state.notice);
  const refusedAt = blamed && anchorOf(scene, blamed);
  return {
    ...(picked.length === 0 ? {} : { picked }),
    ...(refusedAt === undefined ? {} : { refusedAt }),
  };
};
