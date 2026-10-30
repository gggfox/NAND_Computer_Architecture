import { describe, expect, it } from "vitest";

import { piece } from "~/features/projects";
import { newChipId, newInstanceId, newWireId } from "~/shared/ids";

import type { PlaceableInstance } from "./actions";
import { at, twoChips } from "./circuit-edits.fixtures";
import { applyAction, editorErrorMessage } from "./reducer";

const nand: PlaceableInstance = piece({ type: "nand" });

describe("applyAction", () => {
  it("applies instance actions", () => {
    const { project, host, circuit } = twoChips();
    const instanceId = circuit.instances[0]?.id ?? newInstanceId();
    expect(applyAction(project, { type: "placeChip", chipId: host.id, instance: nand }).ok).toBe(
      true,
    );
    expect(
      applyAction(project, { type: "moveChip", chipId: host.id, instanceId, position: at(1) }).ok,
    ).toBe(true);
    expect(applyAction(project, { type: "removeChip", chipId: host.id, instanceId }).ok).toBe(true);
  });

  it("applies wire actions", () => {
    const { project, host, circuit, nand: target } = twoChips();
    const wireId = circuit.wires[0]?.id ?? newWireId();
    const chipId = host.id;
    expect(applyAction(project, { type: "removeWire", chipId, wireId }).ok).toBe(true);
    expect(applyAction(project, { type: "moveWaypoint", chipId, wireId, waypoints: [] }).ok).toBe(
      true,
    );
    const pin = { instanceId: target.id, pin: 2 };
    const connect = applyAction(project, {
      type: "connectWire",
      chipId,
      wireId: newWireId(),
      from: pin,
      to: pin,
    });
    expect(connect).toEqual({ ok: false, error: { type: "OutputToOutput" } });
  });

  it("reports an unknown chip", () => {
    const { project } = twoChips();
    const missing = newChipId();
    const result = applyAction(project, { type: "placeChip", chipId: missing, instance: nand });
    expect(result).toEqual({ ok: false, error: { type: "ChipNotFound", chipId: missing } });
  });
});

describe("editorErrorMessage", () => {
  it("returns a non-empty message for every error", () => {
    const instanceId = newInstanceId();
    const wireId = newWireId();
    const chipId = newChipId();
    const errors = [
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
    ] as const;
    for (const error of errors) {
      expect(editorErrorMessage(error).length).toBeGreaterThan(0);
    }
  });
});
