import { assert, describe, expect, it } from "vitest";

import type { Point } from "~/features/projects";

import { PIN_CELL } from "../chip-layout";
import { wireRoute } from "../geometry";
import type { Scene } from "../geometry";
import { rerouted, routeWire } from "./route";
import {
  edgesOf,
  entersChips,
  link,
  NAND_A,
  NAND_OUT,
  nandAt,
  polylineOf,
  rolesOf,
  sceneOf,
  withCircuit,
} from "./routing.fixtures";

/** Re-routes every wire of the scene and returns the new scene. */
const routedAll = (scene: Scene): Scene => {
  const ids = new Set(scene.circuit.wires.map((item) => item.id));
  return withCircuit(scene, rerouted(scene, ids));
};

/** Every wire's polyline after re-routing them all, in circuit order. */
const polylinesAfter = (scene: Scene): readonly (readonly Point[])[] => {
  const routed = routedAll(scene);
  return routed.circuit.wires.map((item) => polylineOf(routed, item.id));
};

const both = <T>(items: readonly T[]): readonly [T, T] => {
  const [first, second] = items;
  assert(first !== undefined && second !== undefined);
  return [first, second];
};

const heading = (from: Point | undefined, to: Point | undefined): string => {
  assert(from !== undefined && to !== undefined);
  if (from.y === to.y) {
    return to.x > from.x ? "+x" : "-x";
  }
  return from.x === to.x && to.y > from.y ? "+y" : "-y";
};

/** Different signals: no shared lattice edge; shared nodes are right-angle crossings. */
const expectSpaced = (first: readonly Point[], second: readonly Point[]) => {
  const edges = edgesOf(second);
  expect([...edgesOf(first)].filter((edge) => edges.has(edge))).toEqual([]);
  const roles = rolesOf(second);
  for (const [node, role] of rolesOf(first)) {
    const other = roles.get(node);
    if (other !== undefined) {
      expect(role === "stop" || other === "stop" || role === other).toBe(false);
    }
  }
};

const expectOnLattice = (polyline: readonly Point[]) => {
  for (const point of polyline) {
    expect([Math.abs(point.x % PIN_CELL), Math.abs(point.y % PIN_CELL)]).toEqual([0, 0]);
  }
};

describe("routeWire shape", () => {
  it("routes straight when the input is level and to the right", () => {
    const source = nandAt(0, 0);
    const sink = nandAt(400, 20);
    const wire = link([source, NAND_OUT], [sink, NAND_A]);
    const scene = sceneOf([source, sink], [wire]);
    const result = routeWire(scene, wire, []);
    assert(result.ok);
    const [polyline] = polylinesAfter(scene);
    assert(polyline !== undefined);
    expect(new Set(polyline.map((point) => point.y)).size).toBe(1);
    expect(result.value.every((point) => point.y === polyline[0]?.y)).toBe(true);
  });

  it("leaves outputs rightward and enters inputs from the left", () => {
    for (const sinkAt of [nandAt(400, 120), nandAt(-400, 120), nandAt(0, 200)]) {
      const source = nandAt(0, 0);
      const wire = link([source, NAND_OUT], [sinkAt, NAND_A]);
      const [polyline] = polylinesAfter(sceneOf([source, sinkAt], [wire]));
      assert(polyline !== undefined);
      expect(heading(polyline[0], polyline[1])).toBe("+x");
      expect(heading(polyline.at(-2), polyline.at(-1))).toBe("+x");
      expectOnLattice(polyline);
    }
  });
});

describe("routeWire chips", () => {
  it("never enters an inflated chip rect", () => {
    const [source, blocker, sink] = [nandAt(0, 0), nandAt(240, 0), nandAt(480, 0)];
    const wire = link([source, NAND_OUT], [sink, NAND_A]);
    const scene = routedAll(sceneOf([source, blocker, sink], [wire]));
    expect(entersChips(scene, polylineOf(scene, wire.id))).toBe(false);
  });

  it("routes a self-loop around its own chip", () => {
    const chip = nandAt(0, 0);
    const wire = link([chip, NAND_OUT], [chip, NAND_A]);
    const scene = routedAll(sceneOf([chip], [wire]));
    const polyline = polylineOf(scene, wire.id);
    expect(polyline.length).toBeGreaterThan(2);
    expect(entersChips(scene, polyline)).toBe(false);
  });
});

describe("routeWire obstacles", () => {
  it("widens its search window to get round a long wall", () => {
    const [source, sink] = [nandAt(0, 0), nandAt(480, 0)];
    const wall = Array.from({ length: 12 }, (_unused, index) => nandAt(240, index * 80 - 440));
    const wire = link([source, NAND_OUT], [sink, NAND_A]);
    const scene = routedAll(sceneOf([source, sink, ...wall], [wire]));
    const polyline = polylineOf(scene, wire.id);
    expect(polyline.length).toBeGreaterThan(2);
    expect(entersChips(scene, polyline)).toBe(false);
  });
});

describe("routeWire spacing", () => {
  it("does not share an edge with another signal", () => {
    const [sourceA, sourceB] = [nandAt(0, 0), nandAt(0, 240)];
    const [sinkA, sinkB] = [nandAt(400, 200), nandAt(400, -40)];
    const wires = [
      link([sourceA, NAND_OUT], [sinkA, NAND_A]),
      link([sourceB, NAND_OUT], [sinkB, NAND_A]),
    ];
    const [first, second] = both(polylinesAfter(sceneOf([sourceA, sourceB, sinkA, sinkB], wires)));
    expectOnLattice(first);
    expectOnLattice(second);
    expectSpaced(first, second);
  });

  it("crosses at right angles when it must", () => {
    const [left, right] = [nandAt(-600, 0), nandAt(800, 20)];
    const [top, bottom] = [nandAt(200, -240), nandAt(320, 280)];
    const across = link([left, NAND_OUT], [right, NAND_A]);
    const down = link([top, NAND_OUT], [bottom, NAND_A]);
    const scene = sceneOf([left, right, top, bottom], [across, down]);
    const routed = withCircuit(scene, rerouted(scene, new Set([down.id])));
    const [first, second] = [polylineOf(routed, across.id), polylineOf(routed, down.id)];
    expectSpaced(first, second);
    const roles = rolesOf(first);
    expect([...rolesOf(second).keys()].some((node) => roles.has(node))).toBe(true);
  });

  it("does not turn on another signal's node", () => {
    const [sourceA, sourceB] = [nandAt(0, 0), nandAt(0, 120)];
    const [sinkA, sinkB] = [nandAt(400, 240), nandAt(400, 120)];
    const wires = [
      link([sourceA, NAND_OUT], [sinkA, NAND_A]),
      link([sourceB, NAND_OUT], [sinkB, NAND_A]),
    ];
    const [first, second] = both(polylinesAfter(sceneOf([sourceA, sourceB, sinkA, sinkB], wires)));
    expectSpaced(first, second);
  });
});

describe("routeWire signals", () => {
  it("shares the trunk with the same signal", () => {
    const [source, upper, lower] = [nandAt(0, 0), nandAt(400, -120), nandAt(400, 120)];
    const wires = [
      link([source, NAND_OUT], [upper, NAND_A]),
      link([source, NAND_OUT], [lower, NAND_A]),
    ];
    const [first, second] = both(polylinesAfter(sceneOf([source, upper, lower], wires)));
    expect(first.slice(0, 2)).toEqual(second.slice(0, 2));
  });

  it("crosses a stretch two other signals share, and ignores itself among the others", () => {
    const [sourceA, sourceB, sourceC] = [nandAt(0, 0), nandAt(0, 240), nandAt(0, 120)];
    const [sinkA, sinkB, sinkC] = [nandAt(400, 200), nandAt(400, -40), nandAt(400, 80)];
    const others = [
      link([sourceA, NAND_OUT], [sinkA, NAND_A]),
      link([sourceB, NAND_OUT], [sinkB, NAND_A]),
    ];
    const third = link([sourceC, NAND_OUT], [sinkC, NAND_A]);
    const scene = sceneOf([sourceA, sourceB, sourceC, sinkA, sinkB, sinkC], [...others, third]);
    const result = routeWire(scene, third, scene.circuit.wires);
    assert(result.ok);
    const mine = wireRoute(scene, { ...third, waypoints: result.value });
    for (const other of others) {
      expectSpaced(mine, polylineOf(scene, other.id));
    }
  });

  it("falls back to sharing an edge when no clean route exists", () => {
    const [sourceA, sourceB, sink] = [nandAt(0, -120), nandAt(0, 120), nandAt(400, 20)];
    const wires = [
      link([sourceA, NAND_OUT], [sink, NAND_A]),
      {
        ...link([sourceB, NAND_OUT], [sink, NAND_A]),
        to: { instanceId: sink.id, pin: NAND_A, bit: 0 },
      },
    ];
    const [first, second] = both(polylinesAfter(sceneOf([sourceA, sourceB, sink], wires)));
    expect(heading(first.at(-2), first.at(-1))).toBe("+x");
    expect(heading(second.at(-2), second.at(-1))).toBe("+x");
  });
});
