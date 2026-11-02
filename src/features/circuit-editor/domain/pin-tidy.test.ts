/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { createDemoProject, EMPTY_CIRCUIT, pinDef, pinPiece } from "~/features/projects";
import type { ChipInstance, Circuit, Point } from "~/features/projects";

import { layoutIn } from "./geometry";
import type { Scene } from "./geometry";
import { PIN_ROW_GAP } from "./pin-placement";
import { tidyMoves } from "./pin-tidy";

const demoScene = (): Scene => {
  const project = createDemoProject("x");
  return { project, circuit: project.chips[0]?.draft ?? EMPTY_CIRCUIT };
};

const movedTo = (item: ChipInstance, position: Point): ChipInstance => ({ ...item, position });

const sceneOf = (circuit: Circuit): Scene => ({ ...demoScene(), circuit });

describe("tidyMoves on the demo", () => {
  it("puts a dragged input back below the first", () => {
    const scene = demoScene();
    const inputs = scene.circuit.pins.filter((pin) => pin.direction === "input");
    const second = scene.circuit.instances.find(
      (item) => item.kind.type === "pin" && item.kind.pinId === inputs[1]?.id,
    );
    const dragged: Circuit = {
      ...scene.circuit,
      instances: scene.circuit.instances.map((item) =>
        item.id === second?.id ? movedTo(item, { x: 400, y: 400 }) : item,
      ),
    };
    expect(tidyMoves(sceneOf(dragged))).toEqual([
      { instanceId: second?.id, position: second?.position },
    ]);
  });

  it("returns nothing for a tidy circuit", () => {
    expect(tidyMoves(demoScene())).toEqual([]);
  });
});

describe("tidyMoves", () => {
  it("returns nothing when there are no pins", () => {
    expect(tidyMoves(sceneOf(EMPTY_CIRCUIT))).toEqual([]);
  });

  it("stacks a second input under the first at the first's x", () => {
    const first = pinDef("A", "input");
    const second = pinDef("B", "input");
    const circuit: Circuit = {
      pins: [first, second],
      instances: [pinPiece(first, { x: 0, y: 0 }), pinPiece(second, { x: 200, y: 300 })],
      wires: [],
    };
    const moves = tidyMoves(sceneOf(circuit));
    expect(moves).toEqual([{ instanceId: circuit.instances[1]?.id, position: { x: 0, y: 80 } }]);
  });

  it("spaces pieces by their real heights", () => {
    const first = pinDef("A", "input", 16);
    const second = pinDef("B", "input");
    const circuit: Circuit = {
      pins: [first, second],
      instances: [pinPiece(first, { x: 0, y: 0 }), pinPiece(second, { x: 0, y: 500 })],
      wires: [],
    };
    const scene = sceneOf(circuit);
    const [top] = circuit.instances;
    const height = top === undefined ? 0 : layoutIn(scene, top).rect.height;
    expect(height).toBe(100);
    // 100 + 40 = 140 is off the grid, so the top snaps to the next step.
    const y = tidyMoves(scene)[0]?.position.y ?? 0;
    expect(y).toBe(160);
    expect(y).toBeGreaterThanOrEqual(height + PIN_ROW_GAP);
  });

  it("tidies outputs in their own column", () => {
    const one = pinDef("O1", "output");
    const two = pinDef("O2", "output");
    const circuit: Circuit = {
      pins: [one, two],
      instances: [pinPiece(one, { x: 320, y: 0 }), pinPiece(two, { x: 0, y: 0 })],
      wires: [],
    };
    expect(tidyMoves(sceneOf(circuit))[0]?.position).toEqual({ x: 320, y: 80 });
  });
});
