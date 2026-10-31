import { describe, expect, it } from "vitest";

import { newWireId } from "~/shared/ids";

import { moveChip, moveWaypoint, placeChip, removeChip, removeWire } from "./circuit-edits";
import { at, draftOf, nandPiece, twoChips, unwired } from "./circuit-edits.fixtures";
import { connectWire } from "./wire-edits";

describe("connectWire", () => {
  it("stores source to sink, with the derived width, and no bends when there is no route", () => {
    // `unwired()` stacks its pin pieces at the origin, so the router finds no route.
    const { project, host, pieceA, nand } = unwired();
    const wireId = newWireId();
    const result = connectWire(project, {
      type: "connectWire",
      chipId: host.id,
      wireId,
      from: { instanceId: nand.id, pin: 0 },
      to: { instanceId: pieceA.id, pin: 0 },
    });
    expect(result.ok && draftOf(result.value, host.id)?.wires).toEqual([
      {
        id: wireId,
        from: { instanceId: pieceA.id, pin: 0 },
        to: { instanceId: nand.id, pin: 0 },
        bitWidth: 1,
        waypoints: [],
        manualWaypoints: false,
      },
    ]);
  });

  it("returns the connection error", () => {
    const { project, host, nand } = unwired();
    const result = connectWire(project, {
      type: "connectWire",
      chipId: host.id,
      wireId: newWireId(),
      from: { instanceId: nand.id, pin: 2 },
      to: { instanceId: nand.id, pin: 2 },
    });
    expect(result).toEqual({ ok: false, error: { type: "OutputToOutput" } });
  });
});

describe("connectWire duplicates", () => {
  it("rejects an existing wire id with DuplicateWire", () => {
    const { project, host, circuit, pieceA, nand } = twoChips();
    const [existing] = circuit.wires;
    const wireId = existing?.id ?? newWireId();
    const result = connectWire(project, {
      type: "connectWire",
      chipId: host.id,
      wireId,
      from: { instanceId: pieceA.id, pin: 0 },
      to: { instanceId: nand.id, pin: 1 },
    });
    expect(result).toEqual({ ok: false, error: { type: "DuplicateWire", wireId } });
  });
});

describe("removeWire", () => {
  it("removes a wire; an unknown one is WireNotFound", () => {
    const { project, host, circuit } = twoChips();
    const [target] = circuit.wires;
    const removed = removeWire(project, {
      type: "removeWire",
      chipId: host.id,
      wireId: target?.id ?? newWireId(),
    });
    expect(removed.ok && draftOf(removed.value, host.id)?.wires).toHaveLength(2);
    const missing = newWireId();
    const result = removeWire(project, { type: "removeWire", chipId: host.id, wireId: missing });
    expect(result).toEqual({ ok: false, error: { type: "WireNotFound", wireId: missing } });
  });
});

describe("moveWaypoint", () => {
  it("stores bends and marks them manual", () => {
    const { project, host, circuit } = twoChips();
    const wireId = circuit.wires[0]?.id ?? newWireId();
    const result = moveWaypoint(project, {
      type: "moveWaypoint",
      chipId: host.id,
      wireId,
      waypoints: [at(40)],
    });
    const moved = result.ok
      ? draftOf(result.value, host.id)?.wires.find((item) => item.id === wireId)
      : undefined;
    expect(moved?.waypoints).toEqual([at(40)]);
    expect(moved?.manualWaypoints).toBe(true);
  });

  it("hands the wire back to the router when there are no bends", () => {
    const { project, host, circuit } = twoChips();
    const wireId = circuit.wires[0]?.id ?? newWireId();
    const bent = moveWaypoint(project, {
      type: "moveWaypoint",
      chipId: host.id,
      wireId,
      waypoints: [at(40)],
    });
    const next = bent.ok ? bent.value : project;
    const result = moveWaypoint(next, {
      type: "moveWaypoint",
      chipId: host.id,
      wireId,
      waypoints: [],
    });
    const routed = result.ok
      ? draftOf(result.value, host.id)?.wires.find((item) => item.id === wireId)
      : undefined;
    expect(routed?.manualWaypoints).toBe(false);
  });
});

describe("moveWaypoint errors", () => {
  it("rejects an unknown wire", () => {
    const { project, host } = twoChips();
    const missing = newWireId();
    const result = moveWaypoint(project, {
      type: "moveWaypoint",
      chipId: host.id,
      wireId: missing,
      waypoints: [],
    });
    expect(result).toEqual({ ok: false, error: { type: "WireNotFound", wireId: missing } });
  });
});

describe("every edit", () => {
  it("leaves its input project unchanged after every edit", () => {
    const { project, host, nand, pieceA, circuit } = twoChips();
    const before = structuredClone(project);
    const wireId = circuit.wires[0]?.id ?? newWireId();
    placeChip(project, { type: "placeChip", chipId: host.id, instance: nandPiece() });
    moveChip(project, { type: "moveChip", chipId: host.id, instanceId: nand.id, position: at(1) });
    removeChip(project, { type: "removeChip", chipId: host.id, instanceId: pieceA.id });
    connectWire(project, {
      type: "connectWire",
      chipId: host.id,
      wireId: newWireId(),
      from: { instanceId: pieceA.id, pin: 0 },
      to: { instanceId: nand.id, pin: 1 },
    });
    removeWire(project, { type: "removeWire", chipId: host.id, wireId });
    moveWaypoint(project, {
      type: "moveWaypoint",
      chipId: host.id,
      wireId,
      waypoints: [at(3)],
    });
    expect(project).toEqual(before);
  });
});
