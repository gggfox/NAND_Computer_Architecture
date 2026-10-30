/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import type { Point } from "~/features/projects";

import { PIN_CELL } from "../chip-layout";
import { wireRoute } from "../geometry";
import type { Scene } from "../geometry";
import { rerouted, routeWire } from "./route";
import {
  edgesOf,
  expectSpaced,
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

/**
 * A free route from a NAND to one below-right of it turns at (380, 40). Another signal comes down
 * to that corner and turns there toward a third chip, so the route must turn elsewhere.
 */
const turnScene = () => {
  const [source, sink, above, beside] = [
    nandAt(0, 0),
    nandAt(400, 200),
    nandAt(0, -160),
    nandAt(440, 20),
  ];
  const corner = { x: 380, y: 40 };
  const other = {
    ...link([above, NAND_OUT], [beside, NAND_A]),
    waypoints: [{ x: 380, y: -120 }, corner],
    manualWaypoints: true,
  };
  const wire = link([source, NAND_OUT], [sink, NAND_A]);
  return { scene: sceneOf([source, sink, above, beside], [wire, other]), wire, other, corner };
};

/**
 * The sink's pin is reached only along a one-cell corridor between two chips, and another signal
 * (a second driver of the same bus pin) already runs the corridor's length.
 */
const corridorScene = () => {
  const [sink, wallAbove, wallBelow] = [nandAt(400, 0), nandAt(260, -80), nandAt(260, 40)];
  const [sourceA, sourceB] = [nandAt(0, -20), nandAt(0, 160)];
  const other = link([sourceA, NAND_OUT], [sink, NAND_A]);
  const wire = link([sourceB, NAND_OUT], [sink, NAND_A]);
  const scene = sceneOf([sink, wallAbove, wallBelow, sourceA, sourceB], [other, wire]);
  return { scene, wire, other };
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
    const { scene, wire, other, corner } = turnScene();
    const free = routeWire(scene, wire, []);
    expect(free).toEqual({ ok: true, value: [corner, { x: 380, y: 220 }] });
    const result = routeWire(scene, wire, [other]);
    assert(result.ok);
    const mine = wireRoute(scene, { ...wire, waypoints: result.value });
    expect(mine).not.toContainEqual(corner);
    expectSpaced(mine, polylineOf(scene, other.id));
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
});

describe("routeWire fallbacks", () => {
  it("falls back to sharing an edge when no clean route exists", () => {
    const { scene, wire, other } = corridorScene();
    const result = routeWire(scene, wire, [other]);
    assert(result.ok);
    expect(result.value.length).toBeGreaterThan(0);
    const mine = wireRoute(scene, { ...wire, waypoints: result.value });
    const theirs = edgesOf(polylineOf(scene, other.id));
    expect([...edgesOf(mine)].filter((edge) => theirs.has(edge)).length).toBeGreaterThan(1);
    expect(heading(mine.at(-2), mine.at(-1))).toBe("+x");
  });

  it("gives wires of different colours from one pin their own paths past the shared stub", () => {
    const [source, upper, lower] = [nandAt(0, 0), nandAt(400, -120), nandAt(400, 120)];
    const red = { ...link([source, NAND_OUT], [upper, NAND_A]), color: "red" };
    const blue = { ...link([source, NAND_OUT], [lower, NAND_A]), color: "blue" };
    const [first, second] = both(polylinesAfter(sceneOf([source, upper, lower], [red, blue])));
    const [anchor] = first;
    assert(anchor !== undefined);
    expectSpaced(first, second, [anchor, { ...anchor, x: anchor.x + PIN_CELL }]);
  });
});
