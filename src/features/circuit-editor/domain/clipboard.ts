/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { ChipInstance, Circuit, PinRef, Point } from "~/features/projects";
import { newInstanceId } from "~/shared/ids";
import type { InstanceId, WireId } from "~/shared/ids";

import type { PlaceableInstance } from "./actions";
import type { Clipboard, Selection } from "./selection";

const isPlaceable = (instance: ChipInstance): instance is PlaceableInstance =>
  instance.kind.type !== "pin";

/** The selected parts and every wire between two of them; `undefined` when no part is selected. */
export const copyOf = (
  circuit: Circuit,
  selection: Selection,
  offset: number,
): Clipboard | undefined => {
  const instances = circuit.instances.filter(
    (item): item is PlaceableInstance => selection.instances.has(item.id) && isPlaceable(item),
  );
  if (instances.length === 0) {
    return undefined;
  }
  const ids = new Set(instances.map((item) => item.id));
  const wires = circuit.wires.filter(
    (wire) => ids.has(wire.from.instanceId) && ids.has(wire.to.instanceId),
  );
  return { instances, wires, offset };
};

/** A copy of the clipboard moved by `delta` (world units), every part and wire with a fresh id. */
export const pastedFrom = (
  clipboard: Clipboard,
  delta: Point,
  newWireId: () => WireId,
): Pick<Clipboard, "instances" | "wires"> => {
  const shift = (point: Point): Point => ({ x: point.x + delta.x, y: point.y + delta.y });
  const ids = new Map<InstanceId, InstanceId>(
    clipboard.instances.map((item) => [item.id, newInstanceId()]),
  );
  const renamed = (id: InstanceId): InstanceId => ids.get(id) ?? id;
  const end = (ref: PinRef): PinRef => ({ ...ref, instanceId: renamed(ref.instanceId) });
  return {
    instances: clipboard.instances.map((item) => ({
      ...item,
      id: renamed(item.id),
      position: shift(item.position),
    })),
    wires: clipboard.wires.map((wire) => ({
      ...wire,
      id: newWireId(),
      from: end(wire.from),
      to: end(wire.to),
      waypoints: wire.waypoints.map(shift),
    })),
  };
};
