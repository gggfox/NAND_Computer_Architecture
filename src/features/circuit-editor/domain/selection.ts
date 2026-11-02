/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Circuit, Point, Wire } from "~/features/projects";
import type { InstanceId, WireId } from "~/shared/ids";

import type { PlaceableInstance } from "./actions";
import type { Rect } from "./chip-layout";

/** What is selected on the open chip. Not an edit: it lives outside undo history. */
export interface Selection {
  readonly instances: ReadonlySet<InstanceId>;
  readonly wires: ReadonlySet<WireId>;
}

/**
 * What Ctrl+C or Ctrl+X took: the selected parts and the wires between them, as they were. Pin
 * pieces are the chip's own interface, so they are never copied. Not an edit: it lives outside
 * undo history, and survives moving between chips.
 */
export interface Clipboard {
  readonly instances: readonly PlaceableInstance[];
  readonly wires: readonly Wire[];
  /** How many grid steps the next paste lands from the originals: 0 after a cut, so it returns. */
  readonly offset: number;
}

export const EMPTY_SELECTION: Selection = { instances: new Set(), wires: new Set() };

export const selectInstances = (instanceIds: Iterable<InstanceId>): Selection => ({
  instances: new Set(instanceIds),
  wires: new Set(),
});

export const selectWire = (wireId: WireId): Selection => ({
  instances: new Set(),
  wires: new Set([wireId]),
});

const toggled = <Id>(set: ReadonlySet<Id>, id: Id): ReadonlySet<Id> => {
  const next = new Set(set);
  if (!next.delete(id)) {
    next.add(id);
  }
  return next;
};

export const toggleInstance = (selection: Selection, instanceId: InstanceId): Selection => ({
  ...selection,
  instances: toggled(selection.instances, instanceId),
});

export const toggleWire = (selection: Selection, wireId: WireId): Selection => ({
  ...selection,
  wires: toggled(selection.wires, wireId),
});

export const addInstances = (
  selection: Selection,
  instanceIds: Iterable<InstanceId>,
): Selection => ({
  ...selection,
  instances: new Set([...selection.instances, ...instanceIds]),
});

export const isEmpty = (selection: Selection): boolean =>
  selection.instances.size === 0 && selection.wires.size === 0;

/** A chip as box and lasso selection see it. */
export interface ChipBox {
  readonly instanceId: InstanceId;
  readonly rect: Rect;
}

const HALF = 0.5;

const centreOf = (rect: Rect): Point => ({
  x: rect.x + rect.width * HALF,
  y: rect.y + rect.height * HALF,
});

const holds = (box: Rect, point: Point): boolean =>
  point.x >= box.x &&
  point.x <= box.x + box.width &&
  point.y >= box.y &&
  point.y <= box.y + box.height;

/** The chips whose centre is inside `box` (as in DLS: a chip half in the box stays out). */
export const inBox = (chips: readonly ChipBox[], box: Rect): readonly InstanceId[] =>
  chips.filter((chip) => holds(box, centreOf(chip.rect))).map((chip) => chip.instanceId);

/** Even-odd ray casting; works for concave lassos. */
const inPolygon = (polygon: readonly Point[], point: Point): boolean => {
  let inside = false;
  let previous = polygon.at(-1);
  for (const current of polygon) {
    if (previous !== undefined && current.y > point.y !== previous.y > point.y) {
      const crossX =
        previous.x + ((point.y - previous.y) / (current.y - previous.y)) * (current.x - previous.x);
      if (point.x < crossX) {
        inside = !inside;
      }
    }
    previous = current;
  }
  return inside;
};

/** The chips whose centre is inside the lasso. */
export const inLasso = (
  chips: readonly ChipBox[],
  polygon: readonly Point[],
): readonly InstanceId[] =>
  chips.filter((chip) => inPolygon(polygon, centreOf(chip.rect))).map((chip) => chip.instanceId);

/** Adds every wire whose two ends are both selected chips. */
export const withInnerWires = (circuit: Circuit, selection: Selection): Selection => {
  const inner = circuit.wires.filter(
    (wire) =>
      selection.instances.has(wire.from.instanceId) && selection.instances.has(wire.to.instanceId),
  );
  return { ...selection, wires: new Set([...selection.wires, ...inner.map((wire) => wire.id)]) };
};

/** Drops ids the circuit no longer has (after undo, redo or a delete); unchanged if none. */
export const prune = (selection: Selection, circuit: Circuit): Selection => {
  const instanceIds = new Set(circuit.instances.map((item) => item.id));
  const wireIds = new Set(circuit.wires.map((item) => item.id));
  const instances = [...selection.instances].filter((id) => instanceIds.has(id));
  const wires = [...selection.wires].filter((id) => wireIds.has(id));
  return instances.length === selection.instances.size && wires.length === selection.wires.size
    ? selection
    : { instances: new Set(instances), wires: new Set(wires) };
};
