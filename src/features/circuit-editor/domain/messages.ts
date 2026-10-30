import { persistenceErrorMessage } from "~/features/persistence";
import type { PersistenceError } from "~/features/persistence";
import { findChip } from "~/features/projects";
import type { Circuit, InstanceKind, Project } from "~/features/projects";
import type { EngineEventError } from "~/features/simulation";
import { m } from "~/i18n/paraglide/messages";
import { assertNever } from "~/shared/assert-never";

import type { EditorError } from "./actions";
import { editorErrorMessage } from "./editor-error-messages";
import type { NetlistSourceError } from "./to-netlist-source";

/** Why the circuit is not simulating: it cannot be turned into a netlist, or the engine failed. */
export type SimulationError = NetlistSourceError | EngineEventError;

// Compiler-linked: adding a union case without listing it here fails typecheck.
const SIMULATION_MESSAGES = {
  ChipNotFound: () => m.netlist_error_chip_not_found(),
  ChipNotSaved: () => m.netlist_error_chip_not_saved(),
  RecursiveChip: () => m.netlist_error_recursive_chip(),
  UnconnectedPin: () => m.netlist_error_unconnected_pin(),
  InvalidWire: () => m.netlist_error_invalid_wire(),
  WireLoop: () => m.netlist_error_wire_loop(),
  SignalOutOfRange: () => m.engine_error_signal_out_of_range(),
  BadMessage: () => m.engine_error_bad_message(),
  WorkerFailed: () => m.engine_error_worker_failed(),
} satisfies Record<SimulationError["type"], () => string>;

// The false branch narrows to `never`, so unknown input at runtime reaches `assertNever`.
const isKnownSimulationError = (
  simulationError: SimulationError,
): simulationError is SimulationError => Object.hasOwn(SIMULATION_MESSAGES, simulationError.type);

export const simulationErrorMessage = (simulationError: SimulationError): string =>
  isKnownSimulationError(simulationError)
    ? SIMULATION_MESSAGES[simulationError.type]()
    : assertNever(simulationError);

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

type BuiltInKind = Exclude<InstanceKind, { readonly type: "custom" | "pin" }>;

const builtInName = (kind: BuiltInKind): string => {
  switch (kind.type) {
    case "nand": {
      return m.chip_nand();
    }
    case "clock": {
      return m.chip_clock();
    }
    case "split": {
      return m.chip_split({ width: kind.width });
    }
    case "merge": {
      return m.chip_merge({ width: kind.width });
    }
    default: {
      return assertNever(kind);
    }
  }
};

/**
 * The display name of a part: the built-in's name, a custom chip's name, or a pin piece's pin
 * name. A missing chip or pin has an empty name.
 */
export const partName = (project: Project, circuit: Circuit, kind: InstanceKind): string => {
  if (kind.type === "custom") {
    return findChip(project, kind.chipId)?.name ?? "";
  }
  if (kind.type === "pin") {
    return circuit.pins.find((pin) => pin.id === kind.pinId)?.name ?? "";
  }
  return builtInName(kind);
};
