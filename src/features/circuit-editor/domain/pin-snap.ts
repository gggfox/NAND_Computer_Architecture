/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { ChipInstance, Point } from "~/features/projects";
import type { InstanceId } from "~/shared/ids";

import { GRID } from "./chip-layout";
import type { Rect } from "./chip-layout";
import { layoutIn, partOf } from "./geometry";
import type { Scene } from "./geometry";
import { previewPositions, snap } from "./move";
import { PIN_ROW_GAP } from "./pin-placement";

/** How close a dropped pin piece must come to a column or a slot to snap to it. */
export const PIN_SNAP = GRID;

export interface PinDrop {
  readonly position: Point;
  /** The x of the column the piece lined up with; the renderer draws a guide there. */
  readonly guideX?: number;
}

/** A drag preview: where each moved chip goes, and a lone pin piece's guide. */
export interface DragPreview {
  readonly positions: ReadonlyMap<InstanceId, Point>;
  readonly guideX?: number;
}

/** The value in `values` nearest `target` and within `PIN_SNAP` of it. */
const nearest = (values: readonly number[], target: number): number | undefined =>
  values
    .filter((value) => Math.abs(value - target) <= PIN_SNAP)
    .toSorted((one, other) => Math.abs(one - target) - Math.abs(other - target))[0];

/** Onto the grid; a tie goes up the page, so a slot above keeps at least `PIN_ROW_GAP`. */
const snapUp = (y: number): number => -Math.round(-y / GRID) * GRID + 0;

/** The slots directly below and above each piece, on the grid with at least a row gap. */
const slotsOf = (column: readonly Rect[], height: number): readonly number[] =>
  column.flatMap((rect) => [
    snap({ x: 0, y: rect.y + rect.height + PIN_ROW_GAP }).y,
    snapUp(rect.y - PIN_ROW_GAP - height),
  ]);

/**
 * Another piece of the dragged one's direction: its column is its position's x, which a wide
 * input's body extends left of, and its rect is where it sits in that column.
 */
interface Other {
  readonly x: number;
  readonly rect: Rect;
}

const othersLike = (scene: Scene, dragged: ChipInstance): readonly Other[] => {
  const { circuit } = scene;
  const direction = partOf(circuit, dragged);
  return circuit.instances
    .filter((item) => item.id !== dragged.id && partOf(circuit, item) === direction)
    .map((item) => ({ x: item.position.x, rect: layoutIn(scene, item).rect }));
};

/** A drop near a column: the other pieces, the column's x and the proposed point. */
interface Drop {
  readonly others: readonly Other[];
  readonly guideX: number;
  readonly proposed: Point;
}

/** Into the column at `guideX`, and into a slot of it when near one. */
const intoColumn = (scene: Scene, dragged: ChipInstance, drop: Drop): PinDrop => {
  const { others, guideX, proposed } = drop;
  const column = others.filter((other) => other.x === guideX).map((other) => other.rect);
  const slot = nearest(slotsOf(column, layoutIn(scene, dragged).rect.height), proposed.y);
  return { position: { x: guideX, y: slot ?? snap(proposed).y }, guideX };
};

/**
 * Where a pin piece dragged alone lands: at the x of a piece of the same direction when within
 * `PIN_SNAP` of it (with `guideX` there), then in the slot below or above a piece of that column
 * when within `PIN_SNAP`. Otherwise, and for any other instance, `proposed` snapped to the grid.
 */
export const snapPinDrop = (scene: Scene, instanceId: InstanceId, proposed: Point): PinDrop => {
  const dragged = scene.circuit.instances.find((item) => item.id === instanceId);
  if (dragged?.kind.type !== "pin") {
    return { position: snap(proposed) };
  }
  const others = othersLike(scene, dragged);
  const guideX = nearest(
    others.map((other) => other.x),
    proposed.x,
  );
  return guideX === undefined
    ? { position: snap(proposed) }
    : intoColumn(scene, dragged, { others, guideX, proposed });
};

/**
 * Where the chips in `instanceIds` are drawn while dragged by `delta`, and where they drop: snapped
 * to the grid, and into line when the drag moves exactly one pin piece.
 */
export const dragPreview = (
  scene: Scene,
  instanceIds: ReadonlySet<InstanceId>,
  delta: Point,
): DragPreview => {
  const positions = previewPositions(scene.circuit, instanceIds, delta);
  const [only] = instanceIds;
  const item = scene.circuit.instances.find((instance) => instance.id === only);
  if (instanceIds.size !== 1 || item?.kind.type !== "pin") {
    return { positions };
  }
  const proposed = { x: item.position.x + delta.x, y: item.position.y + delta.y };
  const drop = snapPinDrop(scene, item.id, proposed);
  return {
    positions: new Map([[item.id, drop.position]]),
    ...(drop.guideX === undefined ? {} : { guideX: drop.guideX }),
  };
};
