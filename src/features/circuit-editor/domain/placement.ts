/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { pinDef } from "~/features/projects";
import type { Circuit, PinDef, PinDirection, Point } from "~/features/projects";
import { newInstanceId } from "~/shared/ids";
import type { InstanceId } from "~/shared/ids";

import type { PlaceableKind } from "./actions";
import { GRID, layoutOfKind } from "./chip-layout";
import type { Scene } from "./geometry";
import { snap } from "./move";
import { nextPinNames } from "./pin-placement";

const HALF = 0.5;
const ORIGIN: Point = { x: 0, y: 0 };

/**
 * Where a part of `kind` goes so its centre lands on `world`: the top-left corner snapped to the
 * nearest grid point, so the centre is within half a grid step of `world` on each axis.
 */
export const placementPosition = (scene: Scene, kind: PlaceableKind, world: Point): Point => {
  const { width, height } = layoutOfKind(scene, kind, ORIGIN).rect;
  return snap({ x: world.x - width * HALF, y: world.y - height * HALF });
};

/** One new pin of the chip being edited and its piece: what `addPins` takes for each pin. */
export interface AddedPin {
  readonly pin: PinDef;
  readonly instanceId: InstanceId;
  readonly position: Point;
}

/** A new 1-bit pin with the next free name; its piece (one grid square) is centred on `world`. */
export const pinAt = (circuit: Circuit, direction: PinDirection, world: Point): AddedPin => {
  const [name = ""] = nextPinNames(circuit, direction, 1);
  return {
    pin: pinDef(name, direction),
    instanceId: newInstanceId(),
    position: snap({ x: world.x - GRID * HALF, y: world.y - GRID * HALF }),
  };
};
