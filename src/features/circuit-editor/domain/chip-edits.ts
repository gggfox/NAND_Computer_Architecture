import { EMPTY_CIRCUIT, findChip, isHexColor, planSave, replaceChip } from "~/features/projects";
import type { Chip, Project } from "~/features/projects";
import type { ChipId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { EditorAction, EditorError } from "./actions";
import { rerouteReshaped } from "./route-edits";

type Edit<Type extends EditorAction["type"]> = (
  project: Project,
  action: Extract<EditorAction, { type: Type }>,
) => Result<Project, EditorError>;

const editChip = (
  project: Project,
  chipId: ChipId,
  edit: (chip: Chip) => Result<Chip, EditorError>,
): Result<Project, EditorError> => {
  const chip = findChip(project, chipId);
  if (chip === undefined) {
    return err({ type: "ChipNotFound", chipId });
  }
  const edited = edit(chip);
  return edited.ok ? ok(replaceChip(project, edited.value)) : edited;
};

export const createChip: Edit<"createChip"> = (project, action) => {
  const name = action.name.trim();
  if (findChip(project, action.chipId) !== undefined) {
    return err({ type: "DuplicateChip", chipId: action.chipId });
  }
  if (name === "") {
    return err({ type: "EmptyName" });
  }
  if (!isHexColor(action.color)) {
    return err({ type: "InvalidColor", color: action.color });
  }
  const chip: Chip = {
    id: action.chipId,
    name,
    color: action.color,
    draft: EMPTY_CIRCUIT,
    tags: [],
  };
  return ok({ ...project, chips: [...project.chips, chip] });
};

/**
 * A name sets a chip's width, so wires on its instances in every draft that places it are carried
 * or routed again, in this one edit. The same name changes nothing.
 */
export const renameChip: Edit<"renameChip"> = (project, action) => {
  const name = action.name.trim();
  if (name === "") {
    return err({ type: "EmptyName" });
  }
  if (findChip(project, action.chipId)?.name === name) {
    return ok(project);
  }
  const renamed = editChip(project, action.chipId, (chip) => ok({ ...chip, name }));
  return renamed.ok ? ok(rerouteReshaped(project, renamed.value, action.chipId)) : renamed;
};

export const recolorChip: Edit<"recolorChip"> = (project, action) =>
  isHexColor(action.color)
    ? editChip(project, action.chipId, (chip) => ok({ ...chip, color: action.color }))
    : err({ type: "InvalidColor", color: action.color });

/**
 * Saves with the cascade. The store applies the save to every snapshot and re-routes wires the
 * chip's new shape covers there (`createRerouteAfterSave`), so this result only validates.
 */
export const saveChip: Edit<"saveChip"> = (project, action) => {
  const plan = planSave(project, action.chipId);
  return plan.ok ? ok(plan.value.project) : plan;
};

export const discardDraft: Edit<"discardDraft"> = (project, action) =>
  editChip(project, action.chipId, (chip) =>
    chip.saved === undefined
      ? err({ type: "ChipNotSaved", chipId: chip.id })
      : ok({ ...chip, draft: chip.saved }),
  );
