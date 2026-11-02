import type { ChipInstance, Circuit, PinDef, Project } from "~/features/projects";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { EditorAction, EditorError } from "./actions";
import { editDraft } from "./circuit-edits";
import { insertionIndex } from "./pin-edits";
import { blockedRerouted } from "./route-edits";

type Edit<Type extends EditorAction["type"]> = (
  project: Project,
  action: Extract<EditorAction, { type: Type }>,
) => Result<Project, EditorError>;

/** `pins` with `added` after the last pin of its direction. */
export const withPin = (pins: readonly PinDef[], added: PinDef): readonly PinDef[] => {
  const at = insertionIndex(pins, added);
  return [...pins.slice(0, at), added, ...pins.slice(at)];
};

type Entry = Extract<EditorAction, { type: "addPins" }>["pins"][number];

/** The first id an entry repeats, among the circuit's and the earlier entries'. */
const clash = (circuit: Circuit, entries: readonly Entry[]): EditorError | undefined => {
  const pinIds = new Set(circuit.pins.map((pin) => pin.id));
  const instanceIds = new Set(circuit.instances.map((item) => item.id));
  for (const { pin, instanceId } of entries) {
    if (pinIds.has(pin.id)) {
      return { type: "DuplicatePin", pinId: pin.id };
    }
    if (instanceIds.has(instanceId)) {
      return { type: "DuplicateInstance", instanceId };
    }
    pinIds.add(pin.id);
    instanceIds.add(instanceId);
  }
  return undefined;
};

const pieceOf = ({ pin, instanceId, position }: Entry): ChipInstance => ({
  id: instanceId,
  kind: { type: "pin", pinId: pin.id },
  position,
});

/** Adds several pins and their pieces as one edit, so one undo takes them all back. */
export const addPins: Edit<"addPins"> = (project, action) =>
  editDraft(project, action.chipId, (circuit) => {
    const failure =
      action.pins.length === 0 ? { type: "NothingToAdd" as const } : clash(circuit, action.pins);
    if (failure !== undefined) {
      return err(failure);
    }
    const added: Circuit = {
      ...circuit,
      pins: action.pins.reduce((pins, item) => withPin(pins, item.pin), circuit.pins),
      instances: [...circuit.instances, ...action.pins.map((item) => pieceOf(item))],
    };
    const ids = new Set(action.pins.map((item) => item.instanceId));
    return ok(blockedRerouted({ after: { project, circuit: added } }, ids));
  });
