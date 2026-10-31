import { describe, expect, it } from "vitest";

import { createDemoProject, piece, pinDef } from "~/features/projects";
import { newChipId, newInstanceId, newPinId, newWireId } from "~/shared/ids";

import type { PlaceableInstance } from "./actions";
import { at, twoChips } from "./circuit-edits.fixtures";
import { editorErrorMessage } from "./editor-error-messages";
import { applyAction } from "./reducer";

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
});

describe("applyAction pins and chips", () => {
  it("applies pin actions", () => {
    const { project, host, circuit } = twoChips();
    const chipId = host.id;
    const pinId = circuit.pins[0]?.id ?? newPinId();
    const added = {
      type: "addPin",
      chipId,
      pin: pinDef("C", "input"),
      instanceId: newInstanceId(),
      position: at(1),
    } as const;
    expect(applyAction(project, added).ok).toBe(true);
    expect(applyAction(project, { type: "removePin", chipId, pinId }).ok).toBe(true);
    expect(applyAction(project, { type: "renamePin", chipId, pinId, name: "Z" }).ok).toBe(true);
    expect(applyAction(project, { type: "setPinWidth", chipId, pinId, width: 8 }).ok).toBe(true);
    expect(applyAction(project, { type: "reorderPin", chipId, pinId, toIndex: 1 }).ok).toBe(true);
  });

  it("applies chip actions", () => {
    const { project, host } = twoChips();
    const chipId = host.id;
    const created = {
      type: "createChip",
      chipId: newChipId(),
      name: "N",
      color: "#000000",
    } as const;
    expect(applyAction(project, created).ok).toBe(true);
    expect(applyAction(project, { type: "renameChip", chipId, name: "R" }).ok).toBe(true);
    expect(applyAction(project, { type: "recolorChip", chipId, color: "#ffffff" }).ok).toBe(true);
    expect(applyAction(project, { type: "saveChip", chipId }).ok).toBe(true);
    expect(
      applyAction(project, { type: "discardDraft", chipId: project.chips[1]?.id ?? chipId }).ok,
    ).toBe(true);
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
      { type: "PinNotFound", pinId: newPinId() },
      { type: "DuplicatePin", pinId: newPinId() },
      { type: "PinIndexOutOfRange", index: 7 },
      { type: "DuplicateChip", chipId },
      { type: "EmptyName" },
      { type: "InvalidColor", color: "red" },
      { type: "NothingToRecolor" },
      { type: "NothingToReroute" },
    ] as const;
    for (const error of errors) {
      expect(editorErrorMessage(error).length).toBeGreaterThan(0);
    }
  });

  it("rejects an unknown error with assertNever", () => {
    /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Deliberately violates the exhaustive union to hit assertNever */
    const unknown = JSON.parse('{"type":"Bogus"}') as never;
    expect(() => editorErrorMessage(unknown)).toThrow("Unexpected value");
  });
});

describe("applyAction exhaustiveness", () => {
  it("rejects an unknown action with assertNever", () => {
    /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Deliberately violates the exhaustive union to hit assertNever */
    const unknown = JSON.parse('{"type":"Bogus"}') as never;
    expect(() => applyAction(createDemoProject("x"), unknown)).toThrow("Unexpected value");
  });
});
