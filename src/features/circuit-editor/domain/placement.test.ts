/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { createDemoProject, EMPTY_CIRCUIT, pinDef } from "~/features/projects";
import type { Circuit } from "~/features/projects";

import { GRID, layoutOfKind } from "./chip-layout";
import type { Scene } from "./geometry";
import { pinAt, placementPosition } from "./placement";

const HALF = 0.5;

const demoScene = (): Scene => {
  const project = createDemoProject("x");
  return { project, circuit: project.chips[0]?.draft ?? EMPTY_CIRCUIT };
};

describe("placementPosition", () => {
  it("centres a NAND on the world point, its corner on the nearest grid point", () => {
    const scene = demoScene();
    const world = { x: 215, y: 135 };
    const position = placementPosition(scene, { type: "nand" }, world);
    const { rect } = layoutOfKind(scene, { type: "nand" }, position);
    expect(position).toEqual({ x: 160, y: 80 });
    expect(Math.abs(rect.x + rect.width * HALF - world.x)).toBeLessThanOrEqual(GRID * HALF);
    expect(Math.abs(rect.y + rect.height * HALF - world.y)).toBeLessThanOrEqual(GRID * HALF);
  });

  it("is always on the grid", () => {
    const position = placementPosition(demoScene(), { type: "split", width: 4 }, { x: -7, y: 3 });
    expect(Math.abs(position.x % GRID)).toBe(0);
    expect(Math.abs(position.y % GRID)).toBe(0);
  });
});

describe("pinAt", () => {
  it("names the next free pin, one bit wide, centred on the point", () => {
    const circuit: Circuit = { ...EMPTY_CIRCUIT, pins: [pinDef("A", "input")] };
    const added = pinAt(circuit, "input", { x: 100, y: 60 });
    expect(added.pin).toMatchObject({ name: "B", direction: "input", width: 1 });
    expect(added.position).toEqual({ x: 80, y: 40 });
  });

  it("names outputs by number", () => {
    expect(pinAt(EMPTY_CIRCUIT, "output", { x: 0, y: 0 }).pin.name).toBe("OUT1");
  });
});
