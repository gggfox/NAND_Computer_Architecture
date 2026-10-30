import { canPlace, checkConnection, findChip, replaceChip } from "~/features/projects";
import type { Circuit, Project } from "~/features/projects";
import type { ChipId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { EditorAction, EditorError } from "./actions";

type Edit<Type extends EditorAction["type"]> = (
  project: Project,
  action: Extract<EditorAction, { type: Type }>,
) => Result<Project, EditorError>;

/** Applies `edit` to one chip's draft; its saved version and every other chip stay as they are. */
export const editDraft = (
  project: Project,
  chipId: ChipId,
  edit: (circuit: Circuit) => Result<Circuit, EditorError>,
): Result<Project, EditorError> => {
  const chip = findChip(project, chipId);
  if (chip === undefined) {
    return err({ type: "ChipNotFound", chipId });
  }
  const edited = edit(chip.draft);
  return edited.ok ? ok(replaceChip(project, { ...chip, draft: edited.value })) : edited;
};

export const placeChip: Edit<"placeChip"> = (project, action) => {
  const { instance } = action;
  if (instance.kind.type === "custom") {
    const allowed = canPlace(project, action.chipId, instance.kind.chipId);
    if (!allowed.ok) {
      return allowed;
    }
  }
  return editDraft(project, action.chipId, (circuit) =>
    circuit.instances.some((item) => item.id === instance.id)
      ? err({ type: "DuplicateInstance", instanceId: instance.id })
      : ok({ ...circuit, instances: [...circuit.instances, instance] }),
  );
};

export const moveChip: Edit<"moveChip"> = (project, action) =>
  editDraft(project, action.chipId, (circuit) =>
    circuit.instances.some((item) => item.id === action.instanceId)
      ? ok({
          ...circuit,
          instances: circuit.instances.map((item) =>
            item.id === action.instanceId ? { ...item, position: action.position } : item,
          ),
        })
      : err({ type: "InstanceNotFound", instanceId: action.instanceId }),
  );

export const removeChip: Edit<"removeChip"> = (project, action) =>
  editDraft(project, action.chipId, (circuit) => {
    const target = circuit.instances.find((item) => item.id === action.instanceId);
    if (target === undefined) {
      return err({ type: "InstanceNotFound", instanceId: action.instanceId });
    }
    const removedPin = target.kind.type === "pin" ? target.kind.pinId : undefined;
    return ok({
      pins: circuit.pins.filter((pin) => pin.id !== removedPin),
      instances: circuit.instances.filter((item) => item.id !== action.instanceId),
      wires: circuit.wires.filter(
        (item) =>
          item.from.instanceId !== action.instanceId && item.to.instanceId !== action.instanceId,
      ),
    });
  });

export const connectWire: Edit<"connectWire"> = (project, action) =>
  editDraft(project, action.chipId, (circuit) => {
    if (circuit.wires.some((item) => item.id === action.wireId)) {
      return err({ type: "DuplicateWire", wireId: action.wireId });
    }
    const connection = checkConnection(project, circuit, action.from, action.to);
    if (!connection.ok) {
      return connection;
    }
    const stored = {
      id: action.wireId,
      ...connection.value,
      waypoints: [],
      manualWaypoints: false,
    };
    return ok({ ...circuit, wires: [...circuit.wires, stored] });
  });

export const removeWire: Edit<"removeWire"> = (project, action) =>
  editDraft(project, action.chipId, (circuit) =>
    circuit.wires.some((item) => item.id === action.wireId)
      ? ok({ ...circuit, wires: circuit.wires.filter((item) => item.id !== action.wireId) })
      : err({ type: "WireNotFound", wireId: action.wireId }),
  );

export const moveWaypoint: Edit<"moveWaypoint"> = (project, action) =>
  editDraft(project, action.chipId, (circuit) =>
    circuit.wires.some((item) => item.id === action.wireId)
      ? ok({
          ...circuit,
          wires: circuit.wires.map((item) =>
            item.id === action.wireId
              ? {
                  ...item,
                  waypoints: action.waypoints,
                  manualWaypoints: action.waypoints.length > 0,
                }
              : item,
          ),
        })
      : err({ type: "WireNotFound", wireId: action.wireId }),
  );
