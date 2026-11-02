import { canPlace } from "~/features/projects";
import type { Circuit, Project } from "~/features/projects";
import type { ChipId, InstanceId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { EditorAction, EditorError } from "./actions";
import { editDraft, withoutInstance } from "./circuit-edits";
import type { Edit } from "./circuit-edits";
import { blockedRerouted, reshaped } from "./route-edits";

const missingInstance = (
  circuit: Circuit,
  instanceIds: Iterable<InstanceId>,
): EditorError | undefined => {
  const known = new Set(circuit.instances.map((item) => item.id));
  const missing = [...instanceIds].find((instanceId) => !known.has(instanceId));
  return missing === undefined ? undefined : { type: "InstanceNotFound", instanceId: missing };
};

/**
 * Moves the chips. Wires on moved chips are carried or routed again (`reshaped`), and every
 * automatic wire a moved chip now covers is routed again, all in this one edit; wires blocked
 * elsewhere stay put.
 */
const applyMoves = (
  project: Project,
  circuit: Circuit,
  action: Extract<EditorAction, { type: "moveChips" }>,
): Circuit => {
  const targets = new Map(action.moves.map((move) => [move.instanceId, move.position]));
  const instances = circuit.instances.map((item) => {
    const position = targets.get(item.id);
    return position === undefined ? item : { ...item, position };
  });
  return reshaped(
    { before: { project, circuit }, after: { project, circuit: { ...circuit, instances } } },
    new Set(targets.keys()),
  );
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

/** The first custom part that would make the chip contain itself; `undefined` when all may go in. */
const refusedPart = (
  project: Project,
  action: Extract<EditorAction, { type: "pasteItems" }>,
): EditorError | undefined => {
  const custom = new Set<ChipId>();
  for (const item of action.instances) {
    if (item.kind.type === "custom") {
      custom.add(item.kind.chipId);
    }
  }
  for (const chipId of custom) {
    const allowed = canPlace(project, action.chipId, chipId);
    if (!allowed.ok) {
      return allowed.error;
    }
  }
  return undefined;
};

const duplicateOf = (
  circuit: Circuit,
  action: Extract<EditorAction, { type: "pasteItems" }>,
): EditorError | undefined => {
  const instanceIds = new Set(circuit.instances.map((item) => item.id));
  const instance = action.instances.find((item) => instanceIds.has(item.id));
  if (instance !== undefined) {
    return { type: "DuplicateInstance", instanceId: instance.id };
  }
  const wireIds = new Set(circuit.wires.map((item) => item.id));
  const wire = action.wires.find((item) => wireIds.has(item.id));
  return wire === undefined ? undefined : { type: "DuplicateWire", wireId: wire.id };
};

/**
 * Adds the parts and their wires, then re-routes the automatic wires the new parts now cover. A
 * wire must join two of the pasted parts, so nothing pasted can drive a pin already driven.
 */
export const pasteItems: Edit<"pasteItems"> = (project, action) => {
  if (action.instances.length === 0) {
    return err({ type: "NothingToAdd" });
  }
  const refused = refusedPart(project, action);
  if (refused !== undefined) {
    return err(refused);
  }
  return editDraft(project, action.chipId, (circuit): Result<Circuit, EditorError> => {
    const duplicate = duplicateOf(circuit, action);
    if (duplicate !== undefined) {
      return err(duplicate);
    }
    const added = new Set(action.instances.map((item) => item.id));
    const stray = action.wires.find(
      (wire) => !added.has(wire.from.instanceId) || !added.has(wire.to.instanceId),
    );
    if (stray !== undefined) {
      return err({ type: "WireNotFound", wireId: stray.id });
    }
    const after: Circuit = {
      ...circuit,
      instances: [...circuit.instances, ...action.instances],
      wires: [...circuit.wires, ...action.wires],
    };
    return ok(blockedRerouted({ after: { project, circuit: after } }, added));
  });
};
