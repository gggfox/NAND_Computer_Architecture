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

type InstanceAction = Extract<EditorAction, { type: "placeChip" | "moveChip" | "removeChip" }>;

type Outcome = Result<Project, EditorError>;

const applyInstanceAction = (project: Project, action: InstanceAction): Outcome => {
  switch (action.type) {
    case "placeChip": {
      return placeChip(project, action);
    }
    case "moveChip": {
      return moveChip(project, action);
    }
    case "removeChip": {
      return removeChip(project, action);
    }
    default: {
      return assertNever(action);
    }
  }
};

type PinAction = Extract<
  EditorAction,
  { type: "addPin" | "removePin" | "renamePin" | "setPinWidth" | "reorderPin" }
>;

const applyPinAction = (project: Project, action: PinAction): Outcome => {
  switch (action.type) {
    case "addPin": {
      return addPin(project, action);
    }
    case "removePin": {
      return removePin(project, action);
    }
    case "renamePin": {
      return renamePin(project, action);
    }
    case "setPinWidth": {
      return setPinWidth(project, action);
    }
    case "reorderPin": {
      return reorderPin(project, action);
    }
    default: {
      return assertNever(action);
    }
  }
};

type ChipAction = Extract<
  EditorAction,
  { type: "createChip" | "renameChip" | "recolorChip" | "saveChip" | "discardDraft" }
>;

const applyChipAction = (project: Project, action: ChipAction): Outcome => {
  switch (action.type) {
    case "createChip": {
      return createChip(project, action);
    }
    case "renameChip": {
      return renameChip(project, action);
    }
    case "recolorChip": {
      return recolorChip(project, action);
    }
    case "saveChip": {
      return saveChip(project, action);
    }
    case "discardDraft": {
      return discardDraft(project, action);
    }
    default: {
      return assertNever(action);
    }
  }
};

type WireAction = Extract<EditorAction, { type: "connectWire" | "removeWire" | "moveWaypoint" }>;

const applyWireAction = (project: Project, action: WireAction): Outcome => {
  switch (action.type) {
    case "connectWire": {
      return connectWire(project, action);
    }
    case "removeWire": {
      return removeWire(project, action);
    }
    case "moveWaypoint": {
      return moveWaypoint(project, action);
    }
    default: {
      return assertNever(action);
    }
  }
};

// Compiler-linked: adding an action without sorting it into a group fails typecheck.
const INSTANCE_ACTIONS = {
  placeChip: true,
  moveChip: true,
  removeChip: true,
} satisfies Record<InstanceAction["type"], true>;
const PIN_ACTIONS = {
  addPin: true,
  removePin: true,
  renamePin: true,
  setPinWidth: true,
  reorderPin: true,
} satisfies Record<PinAction["type"], true>;
const CHIP_ACTIONS = {
  createChip: true,
  renameChip: true,
  recolorChip: true,
  saveChip: true,
  discardDraft: true,
} satisfies Record<ChipAction["type"], true>;

const isInstanceAction = (action: EditorAction): action is InstanceAction =>
  Object.hasOwn(INSTANCE_ACTIONS, action.type);
const isPinAction = (action: EditorAction): action is PinAction =>
  Object.hasOwn(PIN_ACTIONS, action.type);
const isChipAction = (action: EditorAction): action is ChipAction =>
  Object.hasOwn(CHIP_ACTIONS, action.type);

export const applyAction = (project: Project, action: EditorAction): Outcome => {
  if (isInstanceAction(action)) {
    return applyInstanceAction(project, action);
  }
  if (isPinAction(action)) {
    return applyPinAction(project, action);
  }
  if (isChipAction(action)) {
    return applyChipAction(project, action);
  }
  return applyWireAction(project, action);
};
