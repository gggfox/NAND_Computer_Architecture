import { describe, expect, it } from "vitest";

import { persistenceErrorMessage } from "~/features/persistence";
import { newInstanceId, newWireId, ProjectIdSchema } from "~/shared/ids";

import { editorStoreErrorMessage, simulationErrorMessage } from "./messages";
import type { SimulationError } from "./messages";
import { editorErrorMessage } from "./reducer";

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

describe("unknown errors", () => {
  it("are rejected by assertNever", () => {
    /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Deliberately violates the exhaustive union to hit assertNever */
    const unknown = JSON.parse('{"type":"Bogus"}') as never;
    expect(() => simulationErrorMessage(unknown)).toThrow("Unexpected value");
    expect(() => editorStoreErrorMessage(unknown)).toThrow("Unexpected value");
  });
});

describe("editorStoreErrorMessage", () => {
  it("routes editor errors to the editor messages", () => {
    for (const error of [
      { type: "InstanceNotFound", instanceId },
      { type: "DuplicateInstance", instanceId },
      { type: "ProtectedInstance", instanceId },
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
