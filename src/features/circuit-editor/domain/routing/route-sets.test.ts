import { assert, describe, expect, it } from "vitest";

import type { Wire } from "~/features/projects";
import { newInstanceId } from "~/shared/ids";

import { blockedWires, rerouted, routeWire, signalOf, unroutedWires } from "./route";
import { link, NAND_A, NAND_OUT, nandAt, polylineOf, sceneOf } from "./routing.fixtures";

const only = (wires: readonly Wire[], index: number): Wire => {
  const found = wires[index];
  assert(found !== undefined);
  return found;
};

describe("routeWire results", () => {
  it("is deterministic", () => {
    const [sourceA, sourceB] = [nandAt(0, 0), nandAt(0, 240)];
    const [sinkA, sinkB] = [nandAt(400, 200), nandAt(400, -40)];
    const [farSource, farSink] = [nandAt(4000, 4000), nandAt(4400, 4000)];
    const wires = [
      link([sourceA, NAND_OUT], [sinkA, NAND_A]),
      link([sourceB, NAND_OUT], [sinkB, NAND_A]),
      link([farSource, NAND_OUT], [farSink, NAND_A]),
    ];
    const scene = sceneOf([sourceA, sourceB, sinkA, sinkB, farSource, farSink], wires);
    const ids = new Set(wires.slice(0, 2).map((item) => item.id));
    expect(rerouted(scene, ids).wires.map((item) => item.waypoints)).toEqual(
      rerouted(scene, ids).wires.map((item) => item.waypoints),
    );
  });

  it("returns NoRoute when the pin is enclosed", () => {
    const [source, sink] = [nandAt(0, 0), nandAt(480, 0)];
    const wire = link([source, NAND_OUT], [sink, NAND_A]);
    const [anchor] = polylineOf(sceneOf([source, sink], [wire]), wire.id);
    assert(anchor !== undefined);
    const cover = nandAt(anchor.x, 0);
    const enclosed = sceneOf([source, sink, cover], [wire]);
    expect(routeWire(enclosed, wire, [])).toEqual({
      ok: false,
      error: { type: "NoRoute", wireId: wire.id },
    });
    const circuit = rerouted(enclosed, new Set([wire.id]));
    expect(only(circuit.wires, 0).waypoints).toEqual([]);
  });

  it("returns NoRoute when an end is missing", () => {
    const source = nandAt(0, 0);
    const wire = link([source, NAND_OUT], [nandAt(400, 0), NAND_A]);
    const dangling = { ...wire, to: { instanceId: newInstanceId(), pin: NAND_A } };
    expect(routeWire(sceneOf([source], [dangling]), dangling, []).ok).toBe(false);
  });
});

describe("rerouted", () => {
  it("rerouted leaves untouched wires identical", () => {
    const [source, sinkA, sinkB] = [nandAt(0, 0), nandAt(400, 120), nandAt(400, -120)];
    const wires = [
      link([source, NAND_OUT], [sinkA, NAND_A]),
      link([source, NAND_OUT], [sinkB, NAND_A]),
    ];
    const scene = sceneOf([source, sinkA, sinkB], wires);
    const circuit = rerouted(scene, new Set([only(wires, 0).id]));
    expect(circuit.wires[1]).toBe(wires[1]);
    expect(circuit.wires[0]).not.toBe(wires[0]);
    expect(circuit.instances).toBe(scene.circuit.instances);
    expect(only(circuit.wires, 0).manualWaypoints).toBe(false);
  });
});

describe("wire sets", () => {
  it("blockedWires finds an automatic wire under a newly placed chip and skips manual ones", () => {
    const [source, sink] = [nandAt(0, 0), nandAt(480, 0)];
    const automatic = link([source, NAND_OUT], [sink, NAND_A]);
    const manual = { ...link([source, NAND_OUT], [sink, NAND_A]), manualWaypoints: true };
    const dangling = {
      ...automatic,
      id: link([source, NAND_OUT], [sink, NAND_A]).id,
      to: { instanceId: newInstanceId(), pin: NAND_A },
    };
    const before = sceneOf([source, sink], [automatic, manual, dangling]);
    expect(blockedWires(before)).toEqual(new Set());
    const after = sceneOf([source, sink, nandAt(240, 0)], [automatic, manual, dangling]);
    expect(blockedWires(after)).toEqual(new Set([automatic.id]));
  });

  it("unroutedWires lists automatic wires with no waypoints", () => {
    const [source, sink] = [nandAt(0, 0), nandAt(480, 120)];
    const [fresh, routed] = [
      link([source, NAND_OUT], [sink, NAND_A]),
      link([source, NAND_OUT], [sink, NAND_A]),
    ];
    const manual = { ...link([source, NAND_OUT], [sink, NAND_A]), manualWaypoints: true };
    const circuit = rerouted(
      sceneOf([source, sink], [fresh, routed, manual]),
      new Set([routed.id]),
    );
    expect(only(circuit.wires, 1).waypoints.length).toBeGreaterThan(0);
    expect(unroutedWires(circuit)).toEqual(new Set([fresh.id]));
  });

  it("signalOf names the source pin, bit and colour", () => {
    const source = nandAt(0, 0);
    const wire = link([source, NAND_OUT], [nandAt(400, 0), NAND_A]);
    expect(signalOf(wire)).toBe(`${source.id}:2:*:default`);
    const coloured = { ...wire, from: { ...wire.from, bit: 3 }, color: "red" };
    expect(signalOf(coloured)).toBe(`${source.id}:2:3:red`);
  });
});
