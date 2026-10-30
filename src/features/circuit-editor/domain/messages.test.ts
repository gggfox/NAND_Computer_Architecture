import { assert, describe, expect, it } from "vitest";

import { persistenceErrorMessage } from "~/features/persistence";
import { createDemoProject, EMPTY_CIRCUIT } from "~/features/projects";
import { newChipId, newInstanceId, newPinId, newWireId, ProjectIdSchema } from "~/shared/ids";

import type { EditorError } from "./actions";
import { editorErrorMessage } from "./editor-error-messages";
import { editorStoreErrorMessage, partName, simulationErrorMessage } from "./messages";
import type { SimulationError } from "./messages";

const instanceId = newInstanceId();
const projectId = ProjectIdSchema.parse("11111111-1111-4111-8111-111111111111");

describe("simulationErrorMessage", () => {
  it("gives every netlist and engine error its own non-empty message", () => {
    const errors: readonly SimulationError[] = [
      { type: "ChipNotFound", chipId: newChipId() },
      { type: "ChipNotSaved", chipId: newChipId() },
      { type: "RecursiveChip", chipId: newChipId() },
      { type: "UnconnectedPin", path: [], instanceId, pin: 1, bit: 0 },
      { type: "InvalidWire", path: [instanceId], wireId: newWireId() },
      { type: "WireLoop", path: [], instanceId },
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

describe("partName", () => {
  it("names built-ins, custom chips and pin pieces, and leaves missing ones empty", () => {
    const project = createDemoProject("Demo");
    const [chip] = project.chips;
    assert(chip !== undefined);
    const circuit = chip.draft;
    const [pinA] = circuit.pins;
    expect(pinA).toBeDefined();
    const names = [
      partName(project, circuit, { type: "nand" }),
      partName(project, circuit, { type: "clock" }),
      partName(project, circuit, { type: "split", width: 8 }),
      partName(project, circuit, { type: "merge", width: 4 }),
      partName(project, circuit, { type: "custom", chipId: chip.id }),
      partName(project, circuit, { type: "pin", pinId: pinA?.id ?? newPinId() }),
    ];
    expect(names).toEqual(["NAND", "Clock", "Split 8", "Merge 4", "Demo", "A"]);
    expect(partName(project, EMPTY_CIRCUIT, { type: "custom", chipId: newChipId() })).toBe("");
    expect(partName(project, EMPTY_CIRCUIT, { type: "pin", pinId: newPinId() })).toBe("");
  });

  it("rejects an unknown built-in kind with assertNever", () => {
    /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Deliberately violates the exhaustive union to hit assertNever */
    const unknown = JSON.parse('{"type":"Bogus"}') as never;
    expect(() => partName(createDemoProject("x"), EMPTY_CIRCUIT, unknown)).toThrow(
      "Unexpected value",
    );
  });
});
