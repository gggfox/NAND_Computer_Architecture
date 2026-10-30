/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Circuit, Point, Project, Wire } from "~/features/projects";
import type { InstanceId, WireId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { EditorAction, EditorError } from "./actions";
import { editDraft, withoutInstance } from "./circuit-edits";
import type { Edit } from "./circuit-edits";
import type { Scene } from "./geometry";
import { settled } from "./route-edits";
import { blockedWires } from "./routing/route";

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

/** Hand bends of a wire whose two ends move by the same delta move with it; else `undefined`. */
const carried = (wire: Wire, deltas: Deltas): Wire | undefined => {
  const from = deltas.get(wire.from.instanceId);
  const to = deltas.get(wire.to.instanceId);
  if (
    !wire.manualWaypoints ||
    from === undefined ||
    to === undefined ||
    from.x !== to.x ||
    from.y !== to.y
  ) {
    return undefined;
  }
  return {
    ...wire,
    waypoints: wire.waypoints.map((point) => ({ x: point.x + from.x, y: point.y + from.y })),
  };
};

const touches = (wire: Wire, deltas: Deltas): boolean =>
  deltas.has(wire.from.instanceId) || deltas.has(wire.to.instanceId);

/**
 * Moves the chips. Hand bends that moved whole are carried; every other wire touching a moved
 * chip, and every automatic wire a moved chip now covers, is routed again, all in this one edit.
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
    if (!touches(wire, deltas)) {
      return wire;
    }
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
  const scene: Scene = { project, circuit: { ...circuit, instances, wires } };
  return settled(scene, new Set([...stale, ...blockedWires(scene)]));
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
