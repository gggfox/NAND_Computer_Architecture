/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import { createDemoProject, EMPTY_CIRCUIT, piece, wire } from "~/features/projects";
import type { ChipInstance, Circuit, Project } from "~/features/projects";
import { newChipId, newInstanceId, newPinId } from "~/shared/ids";

import { createLayoutCache } from "./chip-layout";
import {
  freeNandPosition,
  GRID,
  layoutIn,
  partOf,
  pinPosition,
  rectOf,
  wireRoute,
} from "./geometry";
import type { Scene } from "./geometry";

const demo = (): Scene => {
  const project = createDemoProject("x");
  return { project, circuit: project.chips[0]?.draft ?? EMPTY_CIRCUIT };
};

const withCircuit = (project: Project, circuit: Circuit): Scene => ({ project, circuit });

const at = ({ circuit }: Scene, index: number): ChipInstance => {
  const instance = circuit.instances[index];
  assert(instance !== undefined);
  return instance;
};

describe("partOf", () => {
  it("names built-in parts, pin pieces by direction, and custom parts", () => {
    const { circuit } = demo();
    expect(circuit.instances.map((item) => partOf(circuit, item))).toEqual([
      "input",
      "input",
      "nand",
      "output",
    ]);
    const custom = piece({ type: "custom", chipId: newChipId() });
    expect(partOf(circuit, custom)).toBe("custom");
    expect(partOf(circuit, piece({ type: "split", width: 8 }))).toBe("split");
  });

  it("reads a pin piece without a definition as an input", () => {
    const orphan = piece({ type: "pin", pinId: newPinId() });
    expect(partOf(EMPTY_CIRCUIT, orphan)).toBe("input");
  });
});

describe("chip geometry", () => {
  it("places NAND pins on the left (a above b) and the output on the right", () => {
    const scene = demo();
    const nand = at(scene, 2);
    expect(rectOf(scene, nand)).toEqual({ x: 160, y: 40, width: 120, height: 80 });
    expect(pinPosition(scene, nand, 0)).toEqual({ x: 160, y: 60 });
    expect(pinPosition(scene, nand, 1)).toEqual({ x: 160, y: 100 });
    expect(pinPosition(scene, nand, 2)).toEqual({ x: 280, y: 80 });
    expect(pinPosition(scene, nand, 3)).toBeUndefined();
  });

  it("drives from an input's right edge and enters an output's left edge", () => {
    const scene = demo();
    expect(pinPosition(scene, at(scene, 0), 0)).toEqual({ x: 40, y: 20 });
    expect(pinPosition(scene, at(scene, 3), 0)).toEqual({ x: 320, y: 60 });
  });

  it("moves a dragged instance's layout to its preview position", () => {
    const scene = demo();
    const nand = at(scene, 2);
    const layout = createLayoutCache();
    const positions = new Map([[nand.id, { x: 200, y: 0 }]]);
    const moved = layoutIn({ ...scene, layout, positions }, nand);
    expect(moved.rect).toMatchObject({ x: 200, y: 0 });
    expect(moved.pins.map((pin) => pin.anchor)).toEqual([
      { x: 200, y: 20 },
      { x: 200, y: 60 },
      { x: 320, y: 40 },
    ]);
    expect(moved.pins[0]?.tab).toMatchObject({ x: 194, y: 14 });
    expect(layoutIn({ ...scene, layout, positions }, at(scene, 0))).toBe(
      layout(scene, at(scene, 0)),
    );
  });
});

describe("wireRoute", () => {
  it("routes a wire as an orthogonal elbow, or through its waypoints", () => {
    const scene = demo();
    const [first] = scene.circuit.wires;
    assert(first !== undefined);
    expect(wireRoute(scene, first)).toEqual([
      { x: 40, y: 20 },
      { x: 100, y: 20 },
      { x: 100, y: 60 },
      { x: 160, y: 60 },
    ]);
    const bent = { ...first, waypoints: [{ x: 80, y: 0 }] };
    expect(wireRoute(scene, bent)).toEqual([
      { x: 40, y: 20 },
      { x: 80, y: 0 },
      { x: 160, y: 60 },
    ]);
  });

  it("follows a dragged end", () => {
    const scene = demo();
    const [first] = scene.circuit.wires;
    assert(first !== undefined);
    const positions = new Map([[at(scene, 2).id, { x: 160, y: 0 }]]);
    expect(wireRoute({ ...scene, positions }, first).at(-1)).toEqual({ x: 160, y: 20 });
  });

  it("routes nothing for a wire whose ends or pins are missing", () => {
    const scene = demo();
    const dangling = wire(
      { instanceId: newInstanceId(), pin: 0 },
      { instanceId: at(scene, 2).id, pin: 0 },
    );
    expect(wireRoute(scene, dangling)).toEqual([]);
    expect(wireRoute(scene, { ...dangling, from: dangling.to, to: dangling.from })).toEqual([]);
    const noPin = { ...dangling, from: { instanceId: at(scene, 0).id, pin: 7 } };
    expect(wireRoute(scene, noPin)).toEqual([]);
  });
});

describe("freeNandPosition", () => {
  it("finds a free cell for a new NAND that touches no existing chip", () => {
    const scene = demo();
    expect(freeNandPosition(scene)).toEqual({ x: 480, y: 0 });
    const empty = withCircuit(scene.project, EMPTY_CIRCUIT);
    expect(freeNandPosition(empty)).toEqual({ x: 160, y: 0 });
  });

  it("goes below everything when every searched cell is taken", () => {
    const wall = piece({ type: "nand" });
    const instances = Array.from({ length: 8 * 64 }, (_unused, index) => ({
      ...wall,
      id: newInstanceId(),
      position: { x: 160 + (index % 8) * 160, y: Math.floor(index / 8) * 120 },
    }));
    const { project } = demo();
    const position = freeNandPosition(withCircuit(project, { ...EMPTY_CIRCUIT, instances }));
    expect(position).toEqual({ x: 160, y: 63 * 120 + 80 + GRID });
  });
});
