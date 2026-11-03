/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import { pinDef, pinPiece, wire } from "~/features/projects";
import type { Circuit } from "~/features/projects";
import { newWireId } from "~/shared/ids";

import { nandPiece } from "./circuit-edits.fixtures";
import { copiesOf, copyOf } from "./clipboard";
import { selectInstances } from "./selection";

const DELTAS = [
  { x: 0, y: 100 },
  { x: 0, y: 200 },
  { x: 0, y: 300 },
];

/** Two NANDs, the first wired to the second through a hand bend. */
const pair = (): Circuit => {
  const first = nandPiece(0);
  const second = nandPiece(200);
  const link = {
    ...wire({ instanceId: first.id, pin: 2 }, { instanceId: second.id, pin: 0 }),
    waypoints: [{ x: 160, y: 40 }],
    manualWaypoints: true,
  };
  return { pins: [], instances: [first, second], wires: [link] };
};

/** Everything in `circuit`, copied. */
const copiedAll = (circuit: Circuit) => {
  const clipboard = copyOf(circuit, selectInstances(circuit.instances.map((item) => item.id)), 1);
  assert(clipboard !== undefined);
  return clipboard;
};

describe("copiesOf", () => {
  it("makes one copy per delta, each wired within itself", () => {
    const circuit = pair();
    const result = copiesOf(copiedAll(circuit), DELTAS, { target: circuit, newWireId });
    expect(result.instances).toHaveLength(6);
    expect(result.wires).toHaveLength(3);
    expect(new Set(result.instances.map((item) => item.id)).size).toBe(6);
    expect(new Set(result.wires.map((item) => item.id)).size).toBe(3);
    result.wires.forEach((item, index) => {
      const own = result.instances.slice(index * 2, index * 2 + 2).map((entry) => entry.id);
      expect([item.from.instanceId, item.to.instanceId]).toEqual(own);
    });
  });

  it("moves the waypoints of each wire with its copy", () => {
    const circuit = pair();
    const result = copiesOf(copiedAll(circuit), DELTAS, { target: circuit, newWireId });
    expect(result.wires.map((item) => item.waypoints)).toEqual([
      [{ x: 160, y: 140 }],
      [{ x: 160, y: 240 }],
      [{ x: 160, y: 340 }],
    ]);
  });

  it("gives every copied pin a name no other pin holds", () => {
    const def = pinDef("A", "input");
    const piecePin = pinPiece(def);
    const circuit: Circuit = { pins: [def], instances: [piecePin], wires: [] };
    const result = copiesOf(copiedAll(circuit), DELTAS, { target: circuit, newWireId });
    expect(result.pins.map((item) => item.name)).toEqual(["B", "C", "D"]);
    expect(new Set(result.pins.map((item) => item.id)).size).toBe(3);
    expect(result.instances.map((item) => item.kind)).toEqual(
      result.pins.map((item) => ({ type: "pin", pinId: item.id })),
    );
  });

  it("gives nothing for no deltas", () => {
    const circuit = pair();
    expect(copiesOf(copiedAll(circuit), [], { target: circuit, newWireId })).toEqual({
      instances: [],
      pins: [],
      wires: [],
    });
  });
});
