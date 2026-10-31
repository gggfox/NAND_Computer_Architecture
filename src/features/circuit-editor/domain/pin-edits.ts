import { checkConnection } from "~/features/projects";
import type { Circuit, PinDef, Project } from "~/features/projects";
import type { ChipId, PinId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { EditorAction, EditorError } from "./actions";
import { editDraft, withoutInstance } from "./circuit-edits";
import { blockedRerouted, reshaped } from "./route-edits";

type Edit<Type extends EditorAction["type"]> = (
  project: Project,
  action: Extract<EditorAction, { type: Type }>,
) => Result<Project, EditorError>;

/** Runs `edit` on the chip's draft once the pin is known to exist. */
const editPin = (
  project: Project,
  target: { readonly chipId: ChipId; readonly pinId: PinId },
  edit: (circuit: Circuit, pin: PinDef) => Result<Circuit, EditorError>,
): Result<Project, EditorError> =>
  editDraft(project, target.chipId, (circuit) => {
    const pin = circuit.pins.find((item) => item.id === target.pinId);
    return pin === undefined
      ? err({ type: "PinNotFound", pinId: target.pinId })
      : edit(circuit, pin);
  });

/** After the last pin of the same direction; inputs lead the list when there is none. */
const insertionIndex = (pins: readonly PinDef[], added: PinDef): number => {
  const last = pins.findLastIndex((pin) => pin.direction === added.direction);
  if (last !== -1) {
    return last + 1;
  }
  return added.direction === "input" ? 0 : pins.length;
};

export const addPin: Edit<"addPin"> = (project, action) =>
  editDraft(project, action.chipId, (circuit) => {
    if (circuit.pins.some((pin) => pin.id === action.pin.id)) {
      return err({ type: "DuplicatePin", pinId: action.pin.id });
    }
    if (circuit.instances.some((item) => item.id === action.instanceId)) {
      return err({ type: "DuplicateInstance", instanceId: action.instanceId });
    }
    const at = insertionIndex(circuit.pins, action.pin);
    const added: Circuit = {
      ...circuit,
      pins: [...circuit.pins.slice(0, at), action.pin, ...circuit.pins.slice(at)],
      instances: [
        ...circuit.instances,
        {
          id: action.instanceId,
          kind: { type: "pin", pinId: action.pin.id },
          position: action.position,
        },
      ],
    };
    return ok(
      blockedRerouted({ after: { project, circuit: added } }, new Set([action.instanceId])),
    );
  });

export const removePin: Edit<"removePin"> = (project, action) =>
  editPin(project, action, (circuit) => {
    const pinPiece = circuit.instances.find(
      (item) => item.kind.type === "pin" && item.kind.pinId === action.pinId,
    );
    return ok(
      pinPiece === undefined
        ? { ...circuit, pins: circuit.pins.filter((pin) => pin.id !== action.pinId) }
        : withoutInstance(circuit, pinPiece.id),
    );
  });

export const renamePin: Edit<"renamePin"> = (project, action) => {
  const name = action.name.trim();
  if (name === "") {
    return err({ type: "EmptyName" });
  }
  return editPin(project, action, (circuit) =>
    ok({
      ...circuit,
      pins: circuit.pins.map((pin) => (pin.id === action.pinId ? { ...pin, name } : pin)),
    }),
  );
};

export const setPinWidth: Edit<"setPinWidth"> = (project, action) =>
  editPin(project, action, (circuit) => {
    const resized: Circuit = {
      ...circuit,
      pins: circuit.pins.map((pin) =>
        pin.id === action.pinId ? { ...pin, width: action.width } : pin,
      ),
    };
    const pieceIds = new Set(
      circuit.instances
        .filter((item) => item.kind.type === "pin" && item.kind.pinId === action.pinId)
        .map((item) => item.id),
    );
    const fits = (stored: Circuit["wires"][number]): boolean =>
      !(pieceIds.has(stored.from.instanceId) || pieceIds.has(stored.to.instanceId)) ||
      checkConnection(project, resized, stored.from, stored.to, stored.id).ok;
    const wires = circuit.wires.filter((stored) => fits(stored));
    // Only the pin's own pieces change shape in this draft.
    return ok(
      reshaped(
        { before: { project, circuit }, after: { project, circuit: { ...resized, wires } } },
        pieceIds,
      ),
    );
  });

export const reorderPin: Edit<"reorderPin"> = (project, action) =>
  editPin(project, action, (circuit, pin) => {
    const group = circuit.pins.filter((item) => item.direction === pin.direction);
    if (!Number.isInteger(action.toIndex) || action.toIndex < 0 || action.toIndex >= group.length) {
      return err({ type: "PinIndexOutOfRange", index: action.toIndex });
    }
    const moved = group.filter((item) => item.id !== pin.id);
    moved.splice(action.toIndex, 0, pin);
    const queue = [...moved];
    // The direction keeps the slots it already had; only its own order changes.
    const pins = circuit.pins.map((item) =>
      item.direction === pin.direction ? (queue.shift() ?? item) : item,
    );
    return ok({ ...circuit, pins });
  });
