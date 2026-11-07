/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { ChipInstance, Circuit, PinDef, PinRef, Point, Wire } from "~/features/projects";
import type { InstanceId, WireId } from "~/shared/ids";

import type { Rect } from "./chip-layout";
import { layoutIn } from "./geometry";
import type { Scene } from "./geometry";

export type { Notice, PinAnnouncement, PinCommand } from "./pin-selection";
export type { Ghost, SuggestAnnouncement, SuggestCommand, Suggestions } from "./suggestion-types";
export type { OutputReading, OutputsAnnouncement, ViewCommand } from "./view-command-types";
export { appendPins, samePinOn, togglePinIn } from "./pin-selection";

/** What is selected on the open chip. Not an edit: it lives outside undo history. */
export interface Selection {
  readonly instances: ReadonlySet<InstanceId>;
  readonly wires: ReadonlySet<WireId>;
  /** Whole pins, in the order they were added, with no repeats and no `bit`. */
  readonly pins: readonly PinRef[];
}

/** What a clipboard announcement reports. */
export type ClipboardDid = "copy" | "cut" | "paste" | "duplicate" | "array";

/**
 * What Ctrl+C or Ctrl+X took: the selected pieces, the definitions of the pins among them, and the
 * wires between them, as they were. Not an edit: it lives outside undo history, and survives
 * moving between chips.
 */
export interface Clipboard {
  readonly instances: readonly ChipInstance[];
  readonly pins: readonly PinDef[];
  readonly wires: readonly Wire[];
  /** How many grid steps the next paste lands from the originals: 0 after a cut, so it returns. */
  readonly offset: number;
}

export const EMPTY_SELECTION: Selection = {
  instances: new Set(),
  wires: new Set(),
  pins: [],
};

export const selectInstances = (instanceIds: Iterable<InstanceId>): Selection => ({
  instances: new Set(instanceIds),
  wires: new Set(),
  pins: [],
});

export const selectWire = (wireId: WireId): Selection => ({
  instances: new Set(),
  wires: new Set([wireId]),
  pins: [],
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

/** `selection` with its pins replaced. */
export const withPins = (selection: Selection, pins: readonly PinRef[]): Selection => ({
  ...selection,
  pins,
});

export const isEmpty = (selection: Selection): boolean =>
  selection.instances.size === 0 && selection.wires.size === 0 && selection.pins.length === 0;

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

/** Whether the chip behind `pin` is still there and still has that pin. */
const pinThere = (scene: Scene, pin: PinRef): boolean => {
  const instance = scene.circuit.instances.find((item) => item.id === pin.instanceId);
  return (
    instance !== undefined && layoutIn(scene, instance).pins.some((item) => item.key === pin.pin)
  );
};

/**
 * Drops ids and pins the circuit no longer has (after undo, redo or a delete); unchanged if
 * none.
 */
export const prune = (selection: Selection, scene: Scene): Selection => {
  const { circuit } = scene;
  const instanceIds = new Set(circuit.instances.map((item) => item.id));
  const wireIds = new Set(circuit.wires.map((item) => item.id));
  const instances = [...selection.instances].filter((id) => instanceIds.has(id));
  const wires = [...selection.wires].filter((id) => wireIds.has(id));
  const pins = selection.pins.filter((pin) => pinThere(scene, pin));
  return instances.length === selection.instances.size &&
    wires.length === selection.wires.size &&
    pins.length === selection.pins.length
    ? selection
    : { instances: new Set(instances), wires: new Set(wires), pins };
};
