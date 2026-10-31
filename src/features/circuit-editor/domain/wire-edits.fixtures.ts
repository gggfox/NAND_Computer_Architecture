import { assert } from "vitest";

import type { ChipInstance, Circuit, Project, Wire } from "~/features/projects";
import type { ChipId } from "~/shared/ids";

import type { EditorAction } from "./actions";
import { applyAction } from "./reducer";
import { sceneOf } from "./routing/routing.fixtures";

/** A project whose only chip's draft holds `instances` and `wires`, and that chip's id. */
export const projectOf = (instances: readonly ChipInstance[], wires: readonly Wire[]) => {
  const { project } = sceneOf(instances, wires);
  const chipId = project.chips[0]?.id;
  assert(chipId !== undefined);
  return { project, chipId };
};

export const draftIn = (project: Project, chipId: ChipId): Circuit => {
  const draft = project.chips.find((chip) => chip.id === chipId)?.draft;
  assert(draft !== undefined);
  return draft;
};

export const applied = (project: Project, action: EditorAction): Project => {
  const result = applyAction(project, action);
  assert(result.ok);
  return result.value;
};

export const wireIn = (project: Project, chipId: ChipId, wireId: Wire["id"]): Wire => {
  const found = draftIn(project, chipId).wires.find((item) => item.id === wireId);
  assert(found !== undefined);
  return found;
};
