import { persistenceErrorMessage } from "~/features/persistence";
import type { PersistenceError } from "~/features/persistence";
import type { EngineEventError } from "~/features/simulation";
import { m } from "~/i18n/paraglide/messages";
import { assertNever } from "~/shared/assert-never";

import type { EditorError } from "./actions";
import { editorErrorMessage } from "./editor-error-messages";
import type { NetlistSourceError } from "./to-netlist-source";

/** Why the circuit is not simulating: it cannot be turned into a netlist, or the engine failed. */
export type SimulationError = NetlistSourceError | EngineEventError;

export const simulationErrorMessage = (simulationError: SimulationError): string => {
  switch (simulationError.type) {
    case "UnsupportedPart": {
      return m.netlist_error_unsupported_part();
    }
    case "UnconnectedPin": {
      return m.netlist_error_unconnected_pin();
    }
    case "InvalidWire": {
      return m.netlist_error_invalid_wire();
    }
    case "SignalOutOfRange": {
      return m.engine_error_signal_out_of_range();
    }
    case "BadMessage": {
      return m.engine_error_bad_message();
    }
    case "WorkerFailed": {
      return m.engine_error_worker_failed();
    }
    default: {
      return assertNever(simulationError);
    }
  }
};

// Compiler-linked: adding a union case without listing it here fails typecheck.
const PERSISTENCE_ERRORS = {
  NotFound: true,
  Corrupt: true,
  QuotaExceeded: true,
  Unavailable: true,
} satisfies Record<PersistenceError["type"], true>;

const isPersistenceError = (
  storeError: EditorError | PersistenceError,
): storeError is PersistenceError => Object.hasOwn(PERSISTENCE_ERRORS, storeError.type);

/** The editor store's `lastError` is either a rejected action or a failed autosave. */
export const editorStoreErrorMessage = (storeError: EditorError | PersistenceError): string =>
  isPersistenceError(storeError)
    ? persistenceErrorMessage(storeError)
    : editorErrorMessage(storeError);
