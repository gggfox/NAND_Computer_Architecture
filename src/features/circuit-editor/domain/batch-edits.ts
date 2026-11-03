import { canPlace } from "~/features/projects";
import type { Circuit, Project } from "~/features/projects";
import type { ChipId, InstanceId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { EditorAction, EditorError } from "./actions";
import { editDraft, withoutInstance } from "./circuit-edits";
import type { Edit } from "./circuit-edits";
import { withPin } from "./pin-batch-edits";
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

/** The first of `items` whose id `known` already holds. */
const firstKnown = <Id, Item extends { readonly id: Id }>(
  known: readonly { readonly id: Id }[],
  items: readonly Item[],
): Item | undefined => {
  const ids = new Set(known.map((item) => item.id));
  return items.find((item) => ids.has(item.id));
};

const duplicateOf = (
  circuit: Circuit,
  action: Extract<EditorAction, { type: "pasteItems" }>,
): EditorError | undefined => {
  const instance = firstKnown(circuit.instances, action.instances);
  if (instance !== undefined) {
    return { type: "DuplicateInstance", instanceId: instance.id };
  }
  const pin = firstKnown(circuit.pins, action.pins);
  if (pin !== undefined) {
    return { type: "DuplicatePin", pinId: pin.id };
  }
  const wire = firstKnown(circuit.wires, action.wires);
  return wire === undefined ? undefined : { type: "DuplicateWire", wireId: wire.id };
};

/** A pasted pin piece without its definition, or a definition without its piece. */
const unmatchedPin = (
  action: Extract<EditorAction, { type: "pasteItems" }>,
): EditorError | undefined => {
  const pieces = action.instances.flatMap((item) =>
    item.kind.type === "pin" ? [item.kind.pinId] : [],
  );
  const defined = new Set(action.pins.map((pin) => pin.id));
  const placed = new Set(pieces);
  const missing =
    pieces.find((pinId) => !defined.has(pinId)) ??
    action.pins.find((pin) => !placed.has(pin.id))?.id;
  return missing === undefined ? undefined : { type: "PinNotFound", pinId: missing };
};

/**
 * Adds the pieces, pin definitions and wires, then re-routes the automatic wires the new pieces
 * now cover. A wire must join two of the pasted pieces, so nothing pasted can drive a pin already
 * driven.
 */
export const pasteItems: Edit<"pasteItems"> = (project, action) => {
  if (action.instances.length === 0) {
    return err({ type: "NothingToAdd" });
  }
  const refused = refusedPart(project, action) ?? unmatchedPin(action);
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
      pins: action.pins.reduce(withPin, circuit.pins),
      instances: [...circuit.instances, ...action.instances],
      wires: [...circuit.wires, ...action.wires],
    };
    return ok(blockedRerouted({ after: { project, circuit: after } }, added));
  });
};
