import type { ConnectionError, PlaceError, Project } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { assertNever } from "~/shared/assert-never";
import type { Result } from "~/shared/result";

import type { EditorAction, EditorError } from "./actions";
import {
  connectWire,
  moveChip,
  moveWaypoint,
  placeChip,
  removeChip,
  removeWire,
} from "./circuit-edits";

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

export const applyAction = (project: Project, action: EditorAction): Outcome => {
  switch (action.type) {
    case "placeChip":
    case "moveChip":
    case "removeChip": {
      return applyInstanceAction(project, action);
    }
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

const connectionErrorMessage = (failure: ConnectionError): string => {
  switch (failure.type) {
    case "InvalidEndpoint": {
      return m.editor_error_invalid_endpoint();
    }
    case "BitOutOfRange": {
      return m.editor_error_bit_out_of_range({ bit: failure.bit, width: failure.width });
    }
    case "WidthMismatch": {
      return m.editor_error_width_mismatch({ from: failure.from, to: failure.to });
    }
    case "OutputToOutput": {
      return m.editor_error_output_to_output();
    }
    case "InputToInput": {
      return m.editor_error_input_to_input();
    }
    case "InputAlreadyDriven": {
      return m.editor_error_input_already_driven();
    }
    default: {
      return assertNever(failure);
    }
  }
};

const placeErrorMessage = (failure: PlaceError): string => {
  switch (failure.type) {
    case "ChipNotFound": {
      return m.editor_error_chip_not_found({ chipId: failure.chipId });
    }
    case "ChipNotSaved": {
      return m.editor_error_chip_not_saved();
    }
    case "WouldContainItself": {
      return m.editor_error_would_contain_itself();
    }
    default: {
      return assertNever(failure);
    }
  }
};

type EditError = Exclude<EditorError, PlaceError | ConnectionError>;

const editErrorMessage = (failure: EditError): string => {
  switch (failure.type) {
    case "InstanceNotFound": {
      return m.editor_error_instance_not_found({ instanceId: failure.instanceId });
    }
    case "DuplicateInstance": {
      return m.editor_error_duplicate_instance({ instanceId: failure.instanceId });
    }
    case "WireNotFound": {
      return m.editor_error_wire_not_found({ wireId: failure.wireId });
    }
    case "DuplicateWire": {
      return m.editor_error_duplicate_wire({ wireId: failure.wireId });
    }
    default: {
      return assertNever(failure);
    }
  }
};

const PLACE_ERRORS: ReadonlySet<string> = new Set([
  "ChipNotFound",
  "ChipNotSaved",
  "WouldContainItself",
]);
const CONNECTION_ERRORS: ReadonlySet<string> = new Set([
  "InvalidEndpoint",
  "BitOutOfRange",
  "WidthMismatch",
  "OutputToOutput",
  "InputToInput",
  "InputAlreadyDriven",
]);

const isPlaceError = (failure: EditorError): failure is PlaceError =>
  PLACE_ERRORS.has(failure.type);

const isConnectionError = (failure: EditorError): failure is ConnectionError =>
  CONNECTION_ERRORS.has(failure.type);

export const editorErrorMessage = (editorError: EditorError): string => {
  if (isPlaceError(editorError)) {
    return placeErrorMessage(editorError);
  }
  return isConnectionError(editorError)
    ? connectionErrorMessage(editorError)
    : editErrorMessage(editorError);
};
