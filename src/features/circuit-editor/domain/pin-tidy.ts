/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { ChipInstance, PinDirection, Point } from "~/features/projects";
import type { InstanceId } from "~/shared/ids";

import { layoutIn } from "./geometry";
import type { Scene } from "./geometry";
import { movesFor, snapFrom } from "./move";
import type { Move } from "./move";
import { PIN_ROW_GAP } from "./pin-placement";

/** The pieces of `direction`, in panel order. */
const piecesOf = (scene: Scene, direction: PinDirection): readonly ChipInstance[] =>
  scene.circuit.pins
    .filter((pin) => pin.direction === direction)
    .flatMap((pin) =>
      scene.circuit.instances.filter(
        (item) => item.kind.type === "pin" && item.kind.pinId === pin.id,
      ),
    );

/** Stacks the pieces in a column at the anchor's x, each `PIN_ROW_GAP` below the last, on the anchor's rows. */
const stacked = (scene: Scene, column: readonly ChipInstance[], anchor: Point) => {
  const positions = new Map<InstanceId, Point>();
  let top = anchor.y;
  for (const item of column) {
    const point = snapFrom({ x: anchor.x, y: top }, anchor);
    positions.set(item.id, point);
    top = point.y + layoutIn(scene, item).rect.height + PIN_ROW_GAP;
  }
  return positions;
};

/** The column keeps the position of its first piece. */
const columnOf = (scene: Scene, direction: PinDirection): ReadonlyMap<InstanceId, Point> => {
  const column = piecesOf(scene, direction);
  const [first] = column;
  return first === undefined ? new Map() : stacked(scene, column, first.position);
};

/**
 * The moves that line each direction's pins up in one column, in panel order. The column keeps
 * the position of its first pin; pieces already in place are left out.
 */
export const tidyMoves = (scene: Scene): readonly Move[] =>
  movesFor(scene.circuit, new Map([...columnOf(scene, "input"), ...columnOf(scene, "output")]));
