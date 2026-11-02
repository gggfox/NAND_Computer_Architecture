import { EMPTY_CIRCUIT, findChip, isHexColor, planSave, replaceChip } from "~/features/projects";
import type { Chip, Project } from "~/features/projects";
import type { ChipId, WireId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { EditorAction, EditorError } from "./actions";
import { LIBRARY_HANDLERS } from "./library-edits";
import { rerouteReshaped, settled } from "./route-edits";

type Edit<Type extends EditorAction["type"]> = (
  project: Project,
  action: Extract<EditorAction, { type: Type }>,
) => Result<Project, EditorError>;

type CreateChip = Extract<EditorAction, { type: "createChip" }>;

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

const autoWires = (circuit: Chip["draft"]): ReadonlySet<WireId> =>
  new Set(circuit.wires.filter((wire) => !wire.manualWaypoints).map((wire) => wire.id));

const newChipFailure = (project: Project, action: CreateChip): EditorError | undefined => {
  const { folderId } = action;
  if (findChip(project, action.chipId) !== undefined) {
    return { type: "DuplicateChip", chipId: action.chipId };
  }
  if (action.name.trim() === "") {
    return { type: "EmptyName" };
  }
  if (!isHexColor(action.color)) {
    return { type: "InvalidColor", color: action.color };
  }
  return folderId !== undefined && !project.folders.some((folder) => folder.id === folderId)
    ? { type: "FolderNotFound", folderId }
    : undefined;
};

export const createChip: Edit<"createChip"> = (project, action) => {
  const failure = newChipFailure(project, action);
  if (failure !== undefined) {
    return err(failure);
  }
  const { folderId } = action;
  const chip: Chip = {
    id: action.chipId,
    name: action.name.trim(),
    color: action.color,
    draft: EMPTY_CIRCUIT,
    tags: [],
    starred: false,
    ...(folderId === undefined ? {} : { folderId }),
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

/**
 * Restores the saved version. Its automatic wires are routed again for the chips it places now,
 * since renames and saves of those chips re-route drafts only; hand bends and the parents stay.
 */
export const discardDraft: Edit<"discardDraft"> = (project, action) => {
  const restored = editChip(project, action.chipId, (chip) =>
    chip.saved === undefined
      ? err({ type: "ChipNotSaved", chipId: chip.id })
      : ok({ ...chip, draft: chip.saved }),
  );
  if (!restored.ok) {
    return restored;
  }
  const chip = findChip(restored.value, action.chipId);
  if (chip === undefined) {
    return restored;
  }
  const circuit = settled({ project: restored.value, circuit: chip.draft }, autoWires(chip.draft));
  return circuit === chip.draft
    ? restored
    : ok(replaceChip(restored.value, { ...chip, draft: circuit }));
};

/** Every chip-level handler, the catalog ones (folders, filing, stars, tags, delete) included. */
export const CHIP_HANDLERS = {
  createChip,
  renameChip,
  recolorChip,
  saveChip,
  discardDraft,
  ...LIBRARY_HANDLERS,
};
