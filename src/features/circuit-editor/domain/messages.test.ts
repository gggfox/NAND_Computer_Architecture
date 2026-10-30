import { describe, expect, it } from "vitest";

import { persistenceErrorMessage } from "~/features/persistence";
import { newChipId, newInstanceId, newPinId, newWireId, ProjectIdSchema } from "~/shared/ids";

import type { EditorError } from "./actions";
import { editorErrorMessage } from "./editor-error-messages";
import { editorStoreErrorMessage, simulationErrorMessage } from "./messages";
import type { SimulationError } from "./messages";

const instanceId = newInstanceId();
const projectId = ProjectIdSchema.parse("11111111-1111-4111-8111-111111111111");

describe("simulationErrorMessage", () => {
  it("gives every netlist and engine error its own non-empty message", () => {
    const errors: readonly SimulationError[] = [
      { type: "UnsupportedPart", instanceId },
      { type: "UnconnectedPin", instanceId, pin: 1 },
      { type: "InvalidWire", wireId: newWireId() },
      { type: "SignalOutOfRange", ref: { kind: "nand", index: 3 } },
      { type: "BadMessage" },
      { type: "WorkerFailed" },
    ];
    const messages = errors.map((error) => simulationErrorMessage(error));
    for (const message of messages) {
      expect(message.length).toBeGreaterThan(0);
    }
    expect(new Set(messages).size).toBe(errors.length);
  });
});

describe("editorErrorMessage", () => {
  it("gives every editor error its own message", () => {
    const wireId = newWireId();
    const chipId = newChipId();
    const errors: readonly EditorError[] = [
      { type: "InstanceNotFound", instanceId },
      { type: "DuplicateInstance", instanceId },
      { type: "WireNotFound", wireId },
      { type: "DuplicateWire", wireId },
      { type: "ChipNotFound", chipId },
      { type: "ChipNotSaved", chipId },
      { type: "WouldContainItself", chipId },
      { type: "InvalidEndpoint", instanceId, pin: 0 },
      { type: "BitOutOfRange", bit: 5, width: 4 },
      { type: "WidthMismatch", from: 4, to: 8 },
      { type: "OutputToOutput" },
      { type: "InputToInput" },
      { type: "InputAlreadyDriven", instanceId },
      { type: "PinNotFound", pinId: newPinId() },
      { type: "DuplicatePin", pinId: newPinId() },
      { type: "PinIndexOutOfRange", index: 7 },
      { type: "DuplicateChip", chipId },
      { type: "EmptyName" },
      { type: "InvalidColor", color: "red" },
    ];
    const messages = errors.map((error) => editorErrorMessage(error));
    expect(new Set(messages).size).toBe(errors.length);
  });
});

describe("editorStoreErrorMessage", () => {
  it("routes editor errors to the editor messages", () => {
    for (const error of [
      { type: "InstanceNotFound", instanceId },
      { type: "DuplicateInstance", instanceId },
      { type: "OutputToOutput" },
    ] as const) {
      expect(editorStoreErrorMessage(error)).toBe(editorErrorMessage(error));
    }
  });

  it("routes persistence errors to the persistence messages", () => {
    for (const error of [
      { type: "NotFound", id: projectId },
      { type: "Corrupt", id: projectId, cause: { type: "InvalidJson" } },
      { type: "QuotaExceeded" },
      { type: "Unavailable" },
    ] as const) {
      expect(editorStoreErrorMessage(error)).toBe(persistenceErrorMessage(error));
    }
  });
});
