/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import { createDemoProject, EMPTY_CIRCUIT } from "~/features/projects";
import { InstanceIdSchema } from "~/shared/ids";

import type { Scene } from "./geometry";
import { snapFrom } from "./move";
import { dragPreview } from "./pin-snap";
import { alignToWires } from "./wire-align";

/** The demo: A and B into a NAND, its out into OUT, which lines up with it. */
const demo = () => {
  const project = createDemoProject("x");
  const circuit = project.chips[0]?.draft ?? EMPTY_CIRCUIT;
  const [pieceA, pieceB, nand, pieceOut] = circuit.instances;
  assert(pieceA && pieceB && nand && pieceOut);
  const scene: Scene = { project, circuit };
  return { scene, pieceA, pieceB, nand, pieceOut };
};

describe("alignToWires", () => {
  it("nudges a dropped output half a grid down, so its wire from the NAND runs straight", () => {
    const { scene, pieceOut } = demo();
    // Snapped to (360, 40), its pin is half a grid above the NAND's out.
    expect(dragPreview(scene, new Set([pieceOut.id]), { x: 40, y: -10 }).positions).toEqual(
      new Map([[pieceOut.id, { x: 360, y: 60 }]]),
    );
  });

  it("nudges up as well as down", () => {
    const { scene, pieceOut } = demo();
    // Snapped to (360, 80), its pin is half a grid below the NAND's out.
    expect(dragPreview(scene, new Set([pieceOut.id]), { x: 40, y: 20 }).positions).toEqual(
      new Map([[pieceOut.id, { x: 360, y: 60 }]]),
    );
  });

  it("keeps the grid point when no nudge straightens more wires", () => {
    const { scene, nand } = demo();
    const positions = new Map([[nand.id, { x: 200, y: 40 }]]);
    expect(alignToWires(scene, positions)).toBe(positions);
  });

  it("leaves a drag alone when no wire runs between dragged and still chips", () => {
    const { scene, pieceA, pieceB, nand, pieceOut } = demo();
    const positions = new Map(
      [pieceA, pieceB, nand, pieceOut].map((item) => [
        item.id,
        { x: item.position.x + 40, y: item.position.y },
      ]),
    );
    expect(alignToWires(scene, positions)).toBe(positions);
  });
});

/** The demo's wire from the NAND's out to OUT, in circuit order. */
const OUT_WIRE = 2;

describe("alignToWires with broken wires", () => {
  it("counts a wire with a missing end or pin as not straight", () => {
    const { scene, pieceOut, nand } = demo();
    const outWire = scene.circuit.wires[OUT_WIRE];
    assert(outWire);
    const missing = InstanceIdSchema.parse(crypto.randomUUID());
    const NO_PIN = 9;
    const circuit = {
      ...scene.circuit,
      wires: [
        { ...outWire, from: { instanceId: missing, pin: 0 } },
        { ...outWire, from: { instanceId: nand.id, pin: NO_PIN } },
      ],
    };
    const positions = new Map([[pieceOut.id, { x: 360, y: 40 }]]);
    expect(alignToWires({ ...scene, circuit }, positions)).toBe(positions);
  });
});

describe("snapFrom", () => {
  it("keeps a column's rows half a grid down", () => {
    expect(snapFrom({ x: 330, y: 150 }, { x: 320, y: 60 })).toEqual({ x: 320, y: 140 });
  });

  it("snaps to the grid for an origin on the grid, or any other offset", () => {
    expect(snapFrom({ x: 330, y: 150 }, { x: 320, y: 40 })).toEqual({ x: 320, y: 160 });
    expect(snapFrom({ x: 330, y: 150 }, { x: 320, y: 50 })).toEqual({ x: 320, y: 160 });
  });

  it("reads a negative origin's rows too", () => {
    expect(snapFrom({ x: 0, y: -30 }, { x: 0, y: -20 })).toEqual({ x: 0, y: -20 });
  });
});
