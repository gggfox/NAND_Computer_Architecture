/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import { createDemoProject } from "~/features/projects";
import type { ChipInstance, Circuit } from "~/features/projects";
import { newChipId, newInstanceId, newWireId } from "~/shared/ids";

import { freeNandPosition, GRID, partOf, pinPosition, rectOf, wireRoute } from "./geometry";

const demo = (): Circuit => createDemoProject("x").rootCircuit;

const at = (circuit: Circuit, index: number): ChipInstance => {
  const instance = circuit.instances[index];
  assert(instance !== undefined);
  return instance;
};

describe("chip geometry", () => {
  it("names builtin and custom parts", () => {
    const circuit = demo();
    expect(circuit.instances.map((item) => partOf(item))).toEqual([
      "input",
      "input",
      "nand",
      "output",
    ]);
    const custom: ChipInstance = {
      id: newInstanceId(),
      kind: { type: "custom", chipId: newChipId() },
      position: { x: 0, y: 0 },
    };
    expect(partOf(custom)).toBe("custom");
    expect(rectOf(custom)).toEqual({ x: 0, y: 0, width: GRID, height: GRID });
  });

  it("places NAND pins on the left (a above b) and the output on the right", () => {
    const nand = at(demo(), 2);
    expect(rectOf(nand)).toEqual({ x: 160, y: 40, width: 80, height: 60 });
    expect(pinPosition(nand, 0)).toEqual({ x: 160, y: 55 });
    expect(pinPosition(nand, 1)).toEqual({ x: 160, y: 85 });
    expect(pinPosition(nand, 2)).toEqual({ x: 240, y: 70 });
  });

  it("drives from an input's right edge and enters an output's left edge", () => {
    const circuit = demo();
    expect(pinPosition(at(circuit, 0), 0)).toEqual({ x: 40, y: 20 });
    expect(pinPosition(at(circuit, 3), 0)).toEqual({ x: 320, y: 60 });
  });
});

describe("wireRoute", () => {
  it("routes a wire as an orthogonal elbow, or through its waypoints", () => {
    const circuit = demo();
    const [first] = circuit.wires;
    assert(first !== undefined);
    expect(wireRoute(circuit, first)).toEqual([
      { x: 40, y: 20 },
      { x: 100, y: 20 },
      { x: 100, y: 55 },
      { x: 160, y: 55 },
    ]);
    const bent = { ...first, waypoints: [{ x: 80, y: 0 }] };
    expect(wireRoute(circuit, bent)).toEqual([
      { x: 40, y: 20 },
      { x: 80, y: 0 },
      { x: 160, y: 55 },
    ]);
  });

  it("routes nothing for a wire whose ends are missing", () => {
    const circuit = demo();
    const dangling = {
      id: newWireId(),
      from: { instanceId: newInstanceId(), pin: 0 },
      to: { instanceId: at(circuit, 2).id, pin: 0 },
      bitWidth: 1,
      waypoints: [],
    };
    expect(wireRoute(circuit, dangling)).toEqual([]);
    expect(wireRoute(circuit, { ...dangling, from: dangling.to, to: dangling.from })).toEqual([]);
  });
});

describe("freeNandPosition", () => {
  it("finds a free cell for a new NAND that touches no existing chip", () => {
    const circuit = demo();
    const position = freeNandPosition(circuit);
    expect(position).toEqual({ x: 480, y: 0 });
    expect(freeNandPosition({ instances: [], wires: [] })).toEqual({ x: 160, y: 0 });
  });

  it("goes below everything when every searched cell is taken", () => {
    const wall: ChipInstance = {
      id: newInstanceId(),
      kind: { type: "builtin", builtin: "nand" },
      position: { x: 0, y: 0 },
    };
    // One giant fake chip per cell is overkill; a tall column of chips per searched column suffices.
    const instances = Array.from({ length: 8 * 64 }, (_unused, index) => ({
      ...wall,
      id: newInstanceId(),
      position: { x: 160 + (index % 8) * 160, y: Math.floor(index / 8) * 80 },
    }));
    const position = freeNandPosition({ instances, wires: [] });
    expect(position).toEqual({ x: 160, y: 63 * 80 + 60 + GRID });
  });
});
