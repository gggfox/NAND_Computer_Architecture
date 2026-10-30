/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import { replaceChip } from "~/features/projects";
import type { Circuit, Project, Wire } from "~/features/projects";
import { newInstanceId, newWireId } from "~/shared/ids";

import type { EditorAction } from "./actions";
import { draftOf, twoChips } from "./circuit-edits.fixtures";
import { applyAction } from "./reducer";

const draft = (project: Project, chipId: Parameters<typeof draftOf>[1]): Circuit => {
  const circuit = draftOf(project, chipId);
  assert(circuit !== undefined);
  return circuit;
};

const apply = (project: Project, action: EditorAction): Project => {
  const result = applyAction(project, action);
  assert(result.ok);
  return result.value;
};

/** The wire with one bend at (50, 10). */
const withBend = (wire: Wire): Wire => ({ ...wire, waypoints: [{ x: 50, y: 10 }] });

describe("moveChips", () => {
  it("moves several chips in one change", () => {
    const { project, host, pieceA, nand } = twoChips();
    const moved = apply(project, {
      type: "moveChips",
      chipId: host.id,
      moves: [
        { instanceId: pieceA.id, position: { x: 40, y: 40 } },
        { instanceId: nand.id, position: { x: 200, y: 80 } },
      ],
    });
    const positions = draft(moved, host.id).instances.map((item) => item.position);
    expect(positions).toContainEqual({ x: 40, y: 40 });
    expect(positions).toContainEqual({ x: 200, y: 80 });
  });
});

describe("moveChips and wire bends", () => {
  it("carries the bends of a wire whose two ends move together, and only those", () => {
    const { project, host, pieceA, nand, circuit } = twoChips();
    const bent = circuit.wires.map((wire) => withBend(wire));
    const withBends = replaceChip(project, { ...host, draft: { ...circuit, wires: bent } });
    const moved = apply(withBends, {
      type: "moveChips",
      chipId: host.id,
      moves: [
        { instanceId: pieceA.id, position: { x: pieceA.position.x + 40, y: 80 } },
        { instanceId: nand.id, position: { x: nand.position.x + 40, y: 80 } },
      ],
    });
    const [aToNand, bToNand] = draft(moved, host.id).wires;
    expect(aToNand?.waypoints).toEqual([{ x: 90, y: 90 }]);
    expect(bToNand?.waypoints).toEqual([{ x: 50, y: 10 }]);
  });
});

describe("moveChips errors", () => {
  it("an unknown chip moves nothing; an empty move is NothingToMove", () => {
    const { project, host, pieceA } = twoChips();
    const instanceId = newInstanceId();
    const moves = [
      { instanceId: pieceA.id, position: { x: 40, y: 0 } },
      { instanceId, position: { x: 0, y: 0 } },
    ];
    expect(applyAction(project, { type: "moveChips", chipId: host.id, moves })).toEqual({
      ok: false,
      error: { type: "InstanceNotFound", instanceId },
    });
    expect(applyAction(project, { type: "moveChips", chipId: host.id, moves: [] })).toEqual({
      ok: false,
      error: { type: "NothingToMove" },
    });
  });
});

describe("removeItems", () => {
  it("removes wires, then chips with their wires and pin definitions", () => {
    const { project, host, pieceA, circuit } = twoChips();
    const [, bToNand] = circuit.wires;
    assert(bToNand !== undefined);
    const removed = apply(project, {
      type: "removeItems",
      chipId: host.id,
      instanceIds: [pieceA.id],
      wireIds: [bToNand.id],
    });
    const after = draft(removed, host.id);
    expect(after.pins.map((pin) => pin.name)).toEqual(["B", "OUT"]);
    expect(after.instances).toHaveLength(3);
    expect(after.wires).toHaveLength(1);
  });

  it("an unknown wire or chip removes nothing; an empty selection is NothingToRemove", () => {
    const { project, host, pieceA } = twoChips();
    const [wireId, instanceId] = [newWireId(), newInstanceId()];
    const remove = (instanceIds: (typeof instanceId)[], wireIds: (typeof wireId)[]) =>
      applyAction(project, { type: "removeItems", chipId: host.id, instanceIds, wireIds });
    expect(remove([pieceA.id], [wireId])).toEqual({
      ok: false,
      error: { type: "WireNotFound", wireId },
    });
    expect(remove([instanceId], [])).toEqual({
      ok: false,
      error: { type: "InstanceNotFound", instanceId },
    });
    expect(remove([], [])).toEqual({ ok: false, error: { type: "NothingToRemove" } });
  });
});
