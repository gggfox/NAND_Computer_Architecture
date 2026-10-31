import type { Circuit, Project } from "~/features/projects";
import type { InstanceId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { EditorAction, EditorError } from "./actions";
import { editDraft, withoutInstance } from "./circuit-edits";
import type { Edit } from "./circuit-edits";
import { reshaped } from "./route-edits";

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
