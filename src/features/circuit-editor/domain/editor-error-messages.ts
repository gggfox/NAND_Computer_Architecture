import type { ConnectionError, PlaceError, SaveError } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { assertNever } from "~/shared/assert-never";

import type { EditorError } from "./actions";

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

const placeErrorMessage = (failure: PlaceError | SaveError): string => {
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

type PinChipError = Extract<
  EditorError,
  {
    type:
      | "PinNotFound"
      | "DuplicatePin"
      | "PinIndexOutOfRange"
      | "DuplicateChip"
      | "EmptyName"
      | "InvalidColor";
  }
>;

const pinChipErrorMessage = (failure: PinChipError): string => {
  switch (failure.type) {
    case "PinNotFound": {
      return m.editor_error_pin_not_found({ pinId: failure.pinId });
    }
    case "DuplicatePin": {
      return m.editor_error_duplicate_pin({ pinId: failure.pinId });
    }
    case "PinIndexOutOfRange": {
      return m.editor_error_pin_index_out_of_range({ index: failure.index });
    }
    case "DuplicateChip": {
      return m.editor_error_duplicate_chip({ chipId: failure.chipId });
    }
    case "EmptyName": {
      return m.editor_error_empty_name();
    }
    case "InvalidColor": {
      return m.editor_error_invalid_color({ color: failure.color });
    }
    default: {
      return assertNever(failure);
    }
  }
};

type EditError = Exclude<EditorError, PlaceError | SaveError | ConnectionError | PinChipError>;

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

// Compiler-linked: adding a union case without listing it here fails typecheck.
const PLACE_ERRORS = {
  ChipNotFound: true,
  ChipNotSaved: true,
  WouldContainItself: true,
} satisfies Record<PlaceError["type"] | SaveError["type"], true>;
const CONNECTION_ERRORS = {
  InvalidEndpoint: true,
  BitOutOfRange: true,
  WidthMismatch: true,
  OutputToOutput: true,
  InputToInput: true,
  InputAlreadyDriven: true,
} satisfies Record<ConnectionError["type"], true>;

const PIN_CHIP_ERRORS = {
  PinNotFound: true,
  DuplicatePin: true,
  PinIndexOutOfRange: true,
  DuplicateChip: true,
  EmptyName: true,
  InvalidColor: true,
} satisfies Record<PinChipError["type"], true>;

const isPinChipError = (failure: EditorError): failure is PinChipError =>
  Object.hasOwn(PIN_CHIP_ERRORS, failure.type);

const isPlaceError = (failure: EditorError): failure is PlaceError | SaveError =>
  Object.hasOwn(PLACE_ERRORS, failure.type);

const isConnectionError = (failure: EditorError): failure is ConnectionError =>
  Object.hasOwn(CONNECTION_ERRORS, failure.type);

export const editorErrorMessage = (editorError: EditorError): string => {
  if (isPlaceError(editorError)) {
    return placeErrorMessage(editorError);
  }
  if (isPinChipError(editorError)) {
    return pinChipErrorMessage(editorError);
  }
  return isConnectionError(editorError)
    ? connectionErrorMessage(editorError)
    : editErrorMessage(editorError);
};
