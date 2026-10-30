import { m } from "~/i18n/paraglide/messages";
import { assertNever } from "~/shared/assert-never";

import type { EditorError } from "./actions";

type Messages = {
  readonly [Type in EditorError["type"]]: (failure: Extract<EditorError, { type: Type }>) => string;
};

// Compiler-linked: adding an error without a message here fails typecheck.
const MESSAGES: Messages = {
  InstanceNotFound: (failure) =>
    m.editor_error_instance_not_found({ instanceId: failure.instanceId }),
  DuplicateInstance: (failure) =>
    m.editor_error_duplicate_instance({ instanceId: failure.instanceId }),
  WireNotFound: (failure) => m.editor_error_wire_not_found({ wireId: failure.wireId }),
  DuplicateWire: (failure) => m.editor_error_duplicate_wire({ wireId: failure.wireId }),
  InvalidEndpoint: () => m.editor_error_invalid_endpoint(),
  BitOutOfRange: (failure) =>
    m.editor_error_bit_out_of_range({ bit: failure.bit, width: failure.width }),
  WidthMismatch: (failure) => m.editor_error_width_mismatch({ from: failure.from, to: failure.to }),
  OutputToOutput: () => m.editor_error_output_to_output(),
  InputToInput: () => m.editor_error_input_to_input(),
  InputAlreadyDriven: () => m.editor_error_input_already_driven(),
  PinNotFound: (failure) => m.editor_error_pin_not_found({ pinId: failure.pinId }),
  DuplicatePin: (failure) => m.editor_error_duplicate_pin({ pinId: failure.pinId }),
  PinIndexOutOfRange: (failure) => m.editor_error_pin_index_out_of_range({ index: failure.index }),
  DuplicateChip: (failure) => m.editor_error_duplicate_chip({ chipId: failure.chipId }),
  EmptyName: () => m.editor_error_empty_name(),
  InvalidColor: (failure) => m.editor_error_invalid_color({ color: failure.color }),
  ChipNotFound: (failure) => m.editor_error_chip_not_found({ chipId: failure.chipId }),
  ChipNotSaved: () => m.editor_error_chip_not_saved(),
  WouldContainItself: () => m.editor_error_would_contain_itself(),
  NothingToMove: () => m.editor_error_nothing_to_move(),
  NothingToRemove: () => m.editor_error_nothing_to_remove(),
};

// The false branch narrows to `never`, so an unknown error at runtime reaches `assertNever`.
const isKnownError = (failure: EditorError): failure is EditorError =>
  Object.hasOwn(MESSAGES, failure.type);

const messageOf = <Type extends EditorError["type"]>(
  failure: Extract<EditorError, { type: Type }>,
): string => MESSAGES[failure.type](failure);

export const editorErrorMessage = (failure: EditorError): string =>
  isKnownError(failure) ? messageOf(failure) : assertNever(failure);
