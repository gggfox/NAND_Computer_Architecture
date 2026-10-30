import type { Project } from "~/features/projects";
import { assertNever } from "~/shared/assert-never";
import type { Result } from "~/shared/result";

import type { EditorAction, EditorError } from "./actions";
import { createChip, discardDraft, recolorChip, renameChip, saveChip } from "./chip-edits";
import {
  connectWire,
  moveChip,
  moveWaypoint,
  placeChip,
  removeChip,
  removeWire,
} from "./circuit-edits";
import { addPin, removePin, renamePin, reorderPin, setPinWidth } from "./pin-edits";

type Outcome = Result<Project, EditorError>;

type Handlers = {
  readonly [Type in EditorAction["type"]]: (
    project: Project,
    action: Extract<EditorAction, { type: Type }>,
  ) => Outcome;
};

// Compiler-linked: adding an action without a handler here fails typecheck.
const HANDLERS: Handlers = {
  placeChip,
  moveChip,
  removeChip,
  connectWire,
  removeWire,
  moveWaypoint,
  addPin,
  removePin,
  renamePin,
  setPinWidth,
  reorderPin,
  createChip,
  renameChip,
  recolorChip,
  saveChip,
  discardDraft,
};

// The false branch narrows to `never`, so an unknown action at runtime reaches `assertNever`.
const isKnownAction = (action: EditorAction): action is EditorAction =>
  Object.hasOwn(HANDLERS, action.type);

const run = <Type extends EditorAction["type"]>(
  project: Project,
  action: Extract<EditorAction, { type: Type }>,
): Outcome => HANDLERS[action.type](project, action);

export const applyAction = (project: Project, action: EditorAction): Outcome =>
  isKnownAction(action) ? run(project, action) : assertNever(action);
