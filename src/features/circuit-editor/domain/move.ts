/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Circuit, Point } from "~/features/projects";
import type { InstanceId } from "~/shared/ids";

import { GRID, PIN_CELL } from "./chip-layout";

/** The nearest grid point; `+ 0` turns `-0` into `0`. */
export const snap = (point: Point): Point => ({
  x: Math.round(point.x / GRID) * GRID + 0,
  y: Math.round(point.y / GRID) * GRID + 0,
});

/** Half a grid: the row offset a pin column may keep. */
const HALF_GRID = PIN_CELL;

/**
 * `point` on the grid, or on the rows half a grid below it when `origin` sits exactly there. A
 * pin column keeps its first piece's rows this way, also when a drop put that piece half a grid
 * down to straighten a wire (`alignToWires`). Any other offset snaps to the grid.
 */
export const snapFrom = (point: Point, origin: Point): Point => {
  const rowOffset = ((origin.y % GRID) + GRID) % GRID === HALF_GRID ? HALF_GRID : 0;
  const snapped = snap({ x: point.x, y: point.y - rowOffset });
  return { x: snapped.x, y: snapped.y + rowOffset };
};

/** Where each moved chip is drawn while dragged by `delta` (world units), snapped to the grid. */
export const previewPositions = (
  circuit: Circuit,
  instanceIds: ReadonlySet<InstanceId>,
  delta: Point,
): ReadonlyMap<InstanceId, Point> =>
  new Map(
    circuit.instances
      .filter((item) => instanceIds.has(item.id))
      .map((item) => [
        item.id,
        snap({ x: item.position.x + delta.x, y: item.position.y + delta.y }),
      ]),
  );

export interface Move {
  readonly instanceId: InstanceId;
  readonly position: Point;
}

/** The `moveChips` moves for a preview: only the chips that really changed place. */
export const movesFor = (
  circuit: Circuit,
  positions: ReadonlyMap<InstanceId, Point>,
): readonly Move[] =>
  circuit.instances.flatMap((item) => {
    const position = positions.get(item.id);
    return position === undefined ||
      (position.x === item.position.x && position.y === item.position.y)
      ? []
      : [{ instanceId: item.id, position }];
  });
