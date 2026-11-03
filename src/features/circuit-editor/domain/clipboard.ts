/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { ChipInstance, Circuit, PinDef, PinRef, Point } from "~/features/projects";
import { newInstanceId, newPinId } from "~/shared/ids";
import type { InstanceId, PinId, WireId } from "~/shared/ids";

import { nextPinNames } from "./pin-placement";
import type { Clipboard, Selection } from "./selection";

/** The pin ids of the pin pieces among `instances`. */
const pinIdsOf = (instances: readonly ChipInstance[]): ReadonlySet<PinId> =>
  new Set(instances.flatMap((item) => (item.kind.type === "pin" ? [item.kind.pinId] : [])));

/**
 * The selected pieces, their pin definitions and every wire between two of them; `undefined` when
 * no piece is selected.
 */
export const copyOf = (
  circuit: Circuit,
  selection: Selection,
  offset: number,
): Clipboard | undefined => {
  const instances = circuit.instances.filter((item) => selection.instances.has(item.id));
  if (instances.length === 0) {
    return undefined;
  }
  const pinIds = pinIdsOf(instances);
  const ids = new Set(instances.map((item) => item.id));
  const wires = circuit.wires.filter(
    (wire) => ids.has(wire.from.instanceId) && ids.has(wire.to.instanceId),
  );
  return { instances, pins: circuit.pins.filter((pin) => pinIds.has(pin.id)), wires, offset };
};

/**
 * Fresh definitions for the copied pins, by the id they replace, as `target` will hold them: each
 * keeps its name while that name is free there, and takes the next free name of its direction
 * otherwise.
 */
const freshPins = (pins: readonly PinDef[], target: Circuit): ReadonlyMap<PinId, PinDef> => {
  const fresh = new Map<PinId, PinDef>();
  for (const pin of pins) {
    const holding = { ...target, pins: [...target.pins, ...fresh.values()] };
    const taken = holding.pins.some((other) => other.name === pin.name);
    const [name = pin.name] = taken ? nextPinNames(holding, pin.direction, 1) : [pin.name];
    fresh.set(pin.id, { ...pin, id: newPinId(), name });
  }
  return fresh;
};

/** Where a paste goes: moved by `delta` (world units) into `target`, wires taking `newWireId`. */
export interface PasteTarget {
  readonly delta: Point;
  readonly target: Circuit;
  readonly newWireId: () => WireId;
}

/** A copy of the clipboard for `target`: every piece, pin and wire with a fresh id. */
export const pastedFrom = (
  clipboard: Clipboard,
  { delta, target, newWireId }: PasteTarget,
): Omit<Clipboard, "offset"> => {
  const shift = (point: Point): Point => ({ x: point.x + delta.x, y: point.y + delta.y });
  const pins = freshPins(clipboard.pins, target);
  const ids = new Map<InstanceId, InstanceId>(
    clipboard.instances.map((item) => [item.id, newInstanceId()]),
  );
  const renamed = (id: InstanceId): InstanceId => ids.get(id) ?? id;
  const end = (ref: PinRef): PinRef => ({ ...ref, instanceId: renamed(ref.instanceId) });
  const kindOf = (kind: ChipInstance["kind"]): ChipInstance["kind"] =>
    kind.type === "pin" ? { ...kind, pinId: pins.get(kind.pinId)?.id ?? kind.pinId } : kind;
  return {
    instances: clipboard.instances.map((item) => ({
      ...item,
      id: renamed(item.id),
      kind: kindOf(item.kind),
      position: shift(item.position),
    })),
    pins: [...pins.values()],
    wires: clipboard.wires.map((wire) => ({
      ...wire,
      id: newWireId(),
      from: end(wire.from),
      to: end(wire.to),
      waypoints: wire.waypoints.map(shift),
    })),
  };
};

/**
 * One copy of the clipboard per delta, as one batch for `pasteItems`. Each copy sees the pins and
 * pieces of the copies before it, so pin names are unique across all of them.
 */
export const copiesOf = (
  clipboard: Clipboard,
  deltas: readonly Point[],
  { target, newWireId }: Omit<PasteTarget, "delta">,
): Omit<Clipboard, "offset"> => {
  let growing = target;
  const copies = deltas.map((delta) => {
    const copy = pastedFrom(clipboard, { delta, target: growing, newWireId });
    growing = {
      ...growing,
      pins: [...growing.pins, ...copy.pins],
      instances: [...growing.instances, ...copy.instances],
    };
    return copy;
  });
  return {
    instances: copies.flatMap((copy) => copy.instances),
    pins: copies.flatMap((copy) => copy.pins),
    wires: copies.flatMap((copy) => copy.wires),
  };
};
