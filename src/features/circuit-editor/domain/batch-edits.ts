/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Circuit, Point, Project, Wire } from "~/features/projects";
import type { InstanceId, WireId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { EditorAction, EditorError } from "./actions";
import { editDraft, withoutInstance } from "./circuit-edits";
import type { Edit } from "./circuit-edits";
import { newlyBlocked, settled } from "./route-edits";

const missingInstance = (
  circuit: Circuit,
  instanceIds: Iterable<InstanceId>,
): EditorError | undefined => {
  const known = new Set(circuit.instances.map((item) => item.id));
  const missing = [...instanceIds].find((instanceId) => !known.has(instanceId));
  return missing === undefined ? undefined : { type: "InstanceNotFound", instanceId: missing };
};

type Deltas = ReadonlyMap<InstanceId, Point>;

const deltasOf = (
  circuit: Circuit,
  moves: Extract<EditorAction, { type: "moveChips" }>["moves"],
): Deltas => {
  const targets = new Map(moves.map((move) => [move.instanceId, move.position]));
  return new Map(
    circuit.instances.flatMap((item) => {
      const to = targets.get(item.id);
      return to === undefined
        ? []
        : [[item.id, { x: to.x - item.position.x, y: to.y - item.position.y }]];
    }),
  );
};

/**
 * A wire after its chips move, or `undefined` when it must be routed again. Automatic wires and
 * hand bends with one end moved re-route; hand bends whose two ends move by the same delta move
 * with them; hand bends whose ends move apart keep their bends (the router never changes them).
 */
const carried = (wire: Wire, deltas: Deltas): Wire | undefined => {
  const from = deltas.get(wire.from.instanceId);
  const to = deltas.get(wire.to.instanceId);
  if (from === undefined && to === undefined) {
    return wire;
  }
  if (!wire.manualWaypoints || from === undefined || to === undefined) {
    return undefined;
  }
  if (from.x !== to.x || from.y !== to.y) {
    return wire;
  }
  return {
    ...wire,
    waypoints: wire.waypoints.map((point) => ({ x: point.x + from.x, y: point.y + from.y })),
  };
};

/**
 * Moves the chips. Every wire `carried` hands back to the router, and every automatic wire a moved
 * chip now covers, is routed again, all in this one edit; wires blocked elsewhere stay put.
 */
const applyMoves = (
  project: Project,
  circuit: Circuit,
  action: Extract<EditorAction, { type: "moveChips" }>,
): Circuit => {
  const targets = new Map(action.moves.map((move) => [move.instanceId, move.position]));
  const deltas = deltasOf(circuit, action.moves);
  const stale = new Set<WireId>();
  const wires = circuit.wires.map((wire) => {
    const kept = carried(wire, deltas);
    if (kept === undefined) {
      stale.add(wire.id);
    }
    return kept ?? wire;
  });
  const instances = circuit.instances.map((item) => {
    const position = targets.get(item.id);
    return position === undefined ? item : { ...item, position };
  });
  const after = { ...circuit, instances, wires };
  const blocked = newlyBlocked(project, { before: circuit, after }, new Set(deltas.keys()));
  return settled({ project, circuit: after }, new Set([...stale, ...blocked]));
};

/** All moves apply or none do. */
export const moveChips: Edit<"moveChips"> = (project, action) =>
  editDraft(project, action.chipId, (circuit): Result<Circuit, EditorError> => {
    if (action.moves.length === 0) {
      return err({ type: "NothingToMove" });
    }
    const missing = missingInstance(
      circuit,
      action.moves.map((move) => move.instanceId),
    );
    return missing === undefined ? ok(applyMoves(project, circuit, action)) : err(missing);
  });

const removeAll = (
  circuit: Circuit,
  action: Extract<EditorAction, { type: "removeItems" }>,
): Circuit => {
  const wireIds = new Set(action.wireIds);
  const unwired: Circuit = {
    ...circuit,
    wires: circuit.wires.filter((wire) => !wireIds.has(wire.id)),
  };
  return action.instanceIds.reduce<Circuit>(
    (current, instanceId) => withoutInstance(current, instanceId),
    unwired,
  );
};

/** Removes the wires, then the chips with their wires and (for pin pieces) pin definitions. */
export const removeItems: Edit<"removeItems"> = (project, action) =>
  editDraft(project, action.chipId, (circuit): Result<Circuit, EditorError> => {
    if (action.instanceIds.length === 0 && action.wireIds.length === 0) {
      return err({ type: "NothingToRemove" });
    }
    const known = new Set(circuit.wires.map((wire) => wire.id));
    const missingWire = action.wireIds.find((wireId) => !known.has(wireId));
    if (missingWire !== undefined) {
      return err({ type: "WireNotFound", wireId: missingWire });
    }
    const missing = missingInstance(circuit, action.instanceIds);
    return missing === undefined ? ok(removeAll(circuit, action)) : err(missing);
  });
