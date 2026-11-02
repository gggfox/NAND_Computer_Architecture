/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import { createDemoProject, EMPTY_CIRCUIT, pinDef, pinPiece } from "~/features/projects";
import type { Circuit } from "~/features/projects";
import { InstanceIdSchema } from "~/shared/ids";

import { GRID } from "./chip-layout";
import type { Scene } from "./geometry";
import { dragPreview, PIN_SNAP, snapPinDrop } from "./pin-snap";

const demo = () => {
  const project = createDemoProject("x");
  const circuit = project.chips[0]?.draft ?? EMPTY_CIRCUIT;
  const [pieceA, pieceB, nand, pieceOut] = circuit.instances;
  assert(pieceA && pieceB && nand && pieceOut);
  const scene: Scene = { project, circuit };
  return { scene, pieceA, pieceB, nand, pieceOut };
};

const sceneOf = (circuit: Circuit): Scene => ({ ...demo().scene, circuit });

describe("snapPinDrop on the demo", () => {
  it("snaps to the grid", () => {
    expect(PIN_SNAP).toBe(GRID);
  });

  it("lines B up under A's x, with a guide there", () => {
    const { scene, pieceB } = demo();
    expect(snapPinDrop(scene, pieceB.id, { x: 40, y: 200 })).toEqual({
      position: { x: 0, y: 200 },
      guideX: 0,
    });
  });

  it("leaves a far drop alone", () => {
    const { scene, pieceB } = demo();
    expect(snapPinDrop(scene, pieceB.id, { x: 200, y: 200 })).toEqual({
      position: { x: 200, y: 200 },
    });
  });

  it("drops B into the slot below A", () => {
    const { scene, pieceB } = demo();
    expect(snapPinDrop(scene, pieceB.id, { x: 0, y: 60 })).toEqual({
      position: { x: 0, y: 80 },
      guideX: 0,
    });
  });
});

describe("snapPinDrop slots and fallbacks", () => {
  it("drops B into the slot above A", () => {
    const { scene, pieceB } = demo();
    expect(snapPinDrop(scene, pieceB.id, { x: 10, y: -95 })).toEqual({
      position: { x: 0, y: -80 },
      guideX: 0,
    });
  });

  it("grid-snaps an off-grid drop that is not near a slot", () => {
    const { scene, pieceB } = demo();
    expect(snapPinDrop(scene, pieceB.id, { x: 205, y: 213 })).toEqual({
      position: { x: 200, y: 200 },
    });
  });

  it("ignores pieces of the other direction", () => {
    const { scene, pieceA } = demo();
    expect(snapPinDrop(scene, pieceA.id, { x: 280, y: 200 })).toEqual({
      position: { x: 280, y: 200 },
    });
  });

  it("grid-snaps an instance that is not a pin piece, or is gone", () => {
    const { scene, nand } = demo();
    expect(snapPinDrop(scene, nand.id, { x: 15, y: 3 })).toEqual({ position: { x: 0, y: 0 } });
    const gone = InstanceIdSchema.parse("00000000-0000-4000-8000-0000000000ff");
    expect(snapPinDrop(scene, gone, { x: 15, y: 3 })).toEqual({ position: { x: 0, y: 0 } });
  });
});

describe("snapPinDrop with bus pieces", () => {
  const a = pinDef("A", "input", 4);
  const b = pinDef("B", "input", 4);
  const circuit: Circuit = {
    pins: [a, b],
    instances: [pinPiece(a, { x: 0, y: 0 }), pinPiece(b, { x: 400, y: 400 })],
    wires: [],
  };
  const [, pieceB] = circuit.instances;
  assert(pieceB);

  it("keeps at least a row gap below an off-grid bottom", () => {
    // A is 60 tall: its bottom slot is 100, which rounds up to 120.
    expect(snapPinDrop(sceneOf(circuit), pieceB.id, { x: 0, y: 110 }).position).toEqual({
      x: 0,
      y: 120,
    });
  });

  it("keeps at least a row gap above, rounding a tie up the page", () => {
    // B is 60 tall: the slot above A is -100, which rounds to -120.
    expect(snapPinDrop(sceneOf(circuit), pieceB.id, { x: 0, y: -110 }).position).toEqual({
      x: 0,
      y: -120,
    });
  });

  it("takes the nearest of two columns", () => {
    const c = pinDef("C", "input");
    const three: Circuit = {
      ...circuit,
      pins: [...circuit.pins, c],
      instances: [...circuit.instances, pinPiece(c, { x: 40, y: 0 })],
    };
    expect(snapPinDrop(sceneOf(three), pieceB.id, { x: 30, y: 400 })).toEqual({
      position: { x: 40, y: 400 },
      guideX: 40,
    });
  });
});

describe("dragPreview", () => {
  it("snaps a lone pin piece and reports its guide", () => {
    const { scene, pieceB } = demo();
    expect(dragPreview(scene, new Set([pieceB.id]), { x: 30, y: 120 })).toEqual({
      positions: new Map([[pieceB.id, { x: 0, y: 200 }]]),
      guideX: 0,
    });
  });

  it("has no guide when a lone pin piece is dropped far from any column", () => {
    const { scene, pieceB } = demo();
    expect(dragPreview(scene, new Set([pieceB.id]), { x: 205, y: 0 })).toEqual({
      positions: new Map([[pieceB.id, { x: 200, y: 80 }]]),
    });
  });

  it("only grid-snaps a lone chip that is not a pin piece", () => {
    const { scene, nand } = demo();
    expect(dragPreview(scene, new Set([nand.id]), { x: 37, y: 3 })).toEqual({
      positions: new Map([[nand.id, { x: 200, y: 40 }]]),
    });
  });

  it("only grid-snaps several pieces", () => {
    const { scene, pieceA, pieceB } = demo();
    expect(dragPreview(scene, new Set([pieceA.id, pieceB.id]), { x: 30, y: 0 })).toEqual({
      positions: new Map([
        [pieceA.id, { x: 40, y: 0 }],
        [pieceB.id, { x: 40, y: 80 }],
      ]),
    });
  });
});
