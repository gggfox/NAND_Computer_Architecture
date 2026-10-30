import { describe, expect, it } from "vitest";

import { newChip } from "~/features/projects";
import { newChipId, newInstanceId } from "~/shared/ids";

import type { PlaceableInstance } from "./actions";
import { editDraft, moveChip, placeChip, removeChip } from "./circuit-edits";
import { at, customPiece, draftOf, nandPiece, twoChips } from "./circuit-edits.fixtures";

describe("placeChip", () => {
  it("changes only the named chip's draft", () => {
    const { project, host, notChip } = twoChips();
    const result = placeChip(project, {
      type: "placeChip",
      chipId: host.id,
      instance: nandPiece(),
    });
    expect(result.ok && draftOf(result.value, host.id)?.instances).toHaveLength(5);
    const chips = result.ok ? result.value.chips : [];
    expect(chips[0]?.saved).toBe(host.saved);
    expect(chips[1]).toBe(notChip);
  });

  it("places a saved chip", () => {
    const { project, host, notChip } = twoChips();
    const result = placeChip(project, {
      type: "placeChip",
      chipId: host.id,
      instance: customPiece(notChip.id),
    });
    expect(result.ok).toBe(true);
  });
});

describe("placeChip rules", () => {
  it("rejects a draft-only chip with ChipNotSaved", () => {
    const { project, notChip } = twoChips();
    const draftOnly = newChip("D");
    const withDraft = { ...project, chips: [...project.chips, draftOnly] };
    const result = placeChip(withDraft, {
      type: "placeChip",
      chipId: notChip.id,
      instance: customPiece(draftOnly.id),
    });
    expect(result).toEqual({ ok: false, error: { type: "ChipNotSaved", chipId: draftOnly.id } });
  });

  it("rejects a chip placed into itself with WouldContainItself", () => {
    const { project, notChip } = twoChips();
    const result = placeChip(project, {
      type: "placeChip",
      chipId: notChip.id,
      instance: customPiece(notChip.id),
    });
    expect(result).toEqual({
      ok: false,
      error: { type: "WouldContainItself", chipId: notChip.id },
    });
  });

  it("rejects an unknown chip with ChipNotFound", () => {
    const { project } = twoChips();
    const missing = newChipId();
    const result = placeChip(project, {
      type: "placeChip",
      chipId: missing,
      instance: nandPiece(),
    });
    expect(result).toEqual({ ok: false, error: { type: "ChipNotFound", chipId: missing } });
  });

  it("rejects a duplicate instance id", () => {
    const { project, host, nand } = twoChips();
    const instance: PlaceableInstance = { ...nandPiece(), id: nand.id };
    const result = placeChip(project, { type: "placeChip", chipId: host.id, instance });
    expect(result).toEqual({
      ok: false,
      error: { type: "DuplicateInstance", instanceId: nand.id },
    });
  });
});

describe("moveChip", () => {
  it("moves an instance", () => {
    const { project, host, nand } = twoChips();
    const position = at(7);
    const result = moveChip(project, {
      type: "moveChip",
      chipId: host.id,
      instanceId: nand.id,
      position,
    });
    const moved = result.ok
      ? draftOf(result.value, host.id)?.instances.find((item) => item.id === nand.id)
      : undefined;
    expect(moved?.position).toEqual(position);
  });

  it("rejects an unknown instance", () => {
    const { project, host } = twoChips();
    const missing = newInstanceId();
    const result = moveChip(project, {
      type: "moveChip",
      chipId: host.id,
      instanceId: missing,
      position: at(0),
    });
    expect(result).toEqual({ ok: false, error: { type: "InstanceNotFound", instanceId: missing } });
  });
});

describe("removeChip", () => {
  it("removes the instance and its wires", () => {
    const { project, host, nand } = twoChips();
    const result = removeChip(project, {
      type: "removeChip",
      chipId: host.id,
      instanceId: nand.id,
    });
    const circuit = result.ok ? draftOf(result.value, host.id) : undefined;
    expect(circuit?.instances).toHaveLength(3);
    expect(circuit?.wires).toHaveLength(0);
  });

  it("removing a pin piece removes its definition", () => {
    const { project, host, pieceA } = twoChips();
    const result = removeChip(project, {
      type: "removeChip",
      chipId: host.id,
      instanceId: pieceA.id,
    });
    const circuit = result.ok ? draftOf(result.value, host.id) : undefined;
    expect(circuit?.pins.map((pin) => pin.name)).toEqual(["B", "OUT"]);
    expect(circuit?.wires).toHaveLength(2);
  });

  it("rejects an unknown instance", () => {
    const { project, host } = twoChips();
    const result = removeChip(project, {
      type: "removeChip",
      chipId: host.id,
      instanceId: newInstanceId(),
    });
    expect(!result.ok && result.error.type).toBe("InstanceNotFound");
  });
});

describe("editDraft", () => {
  it("is ChipNotFound for a missing chip", () => {
    const { project } = twoChips();
    const missing = newChipId();
    const result = editDraft(project, missing, (circuit) => ({ ok: true, value: circuit }));
    expect(result).toEqual({ ok: false, error: { type: "ChipNotFound", chipId: missing } });
  });
});
