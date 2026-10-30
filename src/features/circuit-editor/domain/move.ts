/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Circuit, Point } from "~/features/projects";
import type { InstanceId } from "~/shared/ids";

import { GRID } from "./chip-layout";

/** The nearest grid point; `+ 0` turns `-0` into `0`. */
export const snap = (point: Point): Point => ({
  x: Math.round(point.x / GRID) * GRID + 0,
  y: Math.round(point.y / GRID) * GRID + 0,
});

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
