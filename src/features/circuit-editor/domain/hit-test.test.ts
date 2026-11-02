/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import { createDemoProject, EMPTY_CIRCUIT, piece } from "~/features/projects";
import type { ChipInstance, Circuit } from "~/features/projects";

import { createLayoutCache } from "./chip-layout";
import type { Scene } from "./geometry";
import { buildIndex, candidatesNear, chipsIn, hitTest, nearestPin } from "./hit-test";

/** The demo: pieces A (0,0) and B (0,80), NAND (160,40) with a (160,60) and b (160,100), OUT (320,40). */
const demo = () => {
  const project = createDemoProject("x");
  const circuit = project.chips[0]?.draft ?? EMPTY_CIRCUIT;
  const part = (index: number): ChipInstance => {
    const instance = circuit.instances[index];
    assert(instance !== undefined);
    return instance;
  };
  const scene: Scene = { project, circuit, layout: createLayoutCache() };
  return { scene, index: buildIndex(scene), pieceA: part(0), nand: part(2) };
};

describe("hitTest priority and reach", () => {
  it("a point on a pin anchor, or within 12 screen px of it, hits the pin", () => {
    const { index, nand } = demo();
    const pinA = { type: "pin", instanceId: nand.id, pin: 0, anchor: { x: 160, y: 60 } };
    expect(hitTest(index, { x: 160, y: 60 }, 1)).toEqual(pinA);
    expect(hitTest(index, { x: 171, y: 60 }, 1)).toEqual(pinA);
    // At zoom 0.25, 11 screen px is 44 world units.
    expect(hitTest(index, { x: 204, y: 60 }, 0.25)).toEqual(pinA);
  });

  it("13 px into the body is the chip", () => {
    const { index, nand } = demo();
    expect(hitTest(index, { x: 173, y: 60 }, 1)).toEqual({ type: "chip", instanceId: nand.id });
  });

  it("the nearest of several pins in reach wins", () => {
    const { index, nand } = demo();
    // Zoomed out, a and b are 10 px apart on screen and both in reach; b is nearer.
    expect(hitTest(index, { x: 160, y: 88 }, 0.25)).toMatchObject({ type: "pin", pin: 1 });
    expect(nearestPin(index, { x: 160, y: 72 }, { reach: 48 })).toMatchObject({
      instanceId: nand.id,
      pin: 0,
    });
  });

  it("a pin beats the wire that ends on it", () => {
    const { index } = demo();
    expect(hitTest(index, { x: 152, y: 60 }, 1)).toMatchObject({ type: "pin", pin: 0 });
  });

  it("near a wire and off every chip is the wire; further out is empty", () => {
    const { index, scene } = demo();
    const [wireToA] = scene.circuit.wires;
    assert(wireToA !== undefined);
    expect(hitTest(index, { x: 110, y: 40 }, 1)).toEqual({ type: "wire", wireId: wireToA.id });
    expect(hitTest(index, { x: 115, y: 40 }, 1)).toEqual({ type: "empty" });
    expect(hitTest(index, { x: 900, y: 900 }, 1)).toEqual({ type: "empty" });
  });
});

describe("hitTest on a pin piece's name", () => {
  it("the name left of input A is its label; zoomed out it still reaches 12 screen px", () => {
    const { index, pieceA } = demo();
    // A's name "A" is drawn right-aligned 8 px left of its body, centred at y = 20.
    expect(hitTest(index, { x: -12, y: 20 }, 1)).toEqual({
      type: "label",
      instanceId: pieceA.id,
    });
    expect(hitTest(index, { x: -12, y: 4 }, 0.5)).toEqual({
      type: "label",
      instanceId: pieceA.id,
    });
    expect(hitTest(index, { x: -40, y: 20 }, 1)).toEqual({ type: "empty" });
  });

  it("the body beats the label", () => {
    const { index, pieceA } = demo();
    expect(hitTest(index, { x: 2, y: 20 }, 1)).toEqual({ type: "chip", instanceId: pieceA.id });
  });
});

describe("hitTest scenes", () => {
  it("hits a dragged chip at its preview position", () => {
    const { scene, nand } = demo();
    const positions = new Map([[nand.id, { x: 400, y: 200 }]]);
    const index = buildIndex({ ...scene, positions });
    expect(hitTest(index, { x: 460, y: 240 }, 1)).toEqual({ type: "chip", instanceId: nand.id });
    // The NAND's old body is empty now (its wires re-route through x = 220 and x = 420).
    expect(hitTest(index, { x: 260, y: 60 }, 1)).toEqual({ type: "empty" });
  });

  it("the topmost (last placed) of overlapping chips wins", () => {
    const { scene } = demo();
    const [below, above] = [piece({ type: "nand" }), piece({ type: "nand" }, { x: 40, y: 0 })];
    const circuit: Circuit = { ...EMPTY_CIRCUIT, instances: [below, above] };
    const index = buildIndex({ project: scene.project, circuit });
    expect(hitTest(index, { x: 80, y: 40 }, 1)).toEqual({ type: "chip", instanceId: above.id });
  });

  it("a wire with a zero-length segment is still hit", () => {
    const { scene } = demo();
    const [first, ...rest] = scene.circuit.wires;
    assert(first !== undefined);
    const doubled = {
      ...first,
      waypoints: [
        { x: 40, y: 20 },
        { x: 100, y: 20 },
        { x: 100, y: 60 },
      ],
    };
    const circuit = { ...scene.circuit, wires: [doubled, ...rest] };
    const index = buildIndex({ project: scene.project, circuit });
    expect(hitTest(index, { x: 100, y: 30 }, 1)).toEqual({ type: "wire", wireId: first.id });
  });
});

describe("nearestPin and chipsIn", () => {
  it("nearestPin skips pins `accept` rejects, and finds none out of reach", () => {
    const { index } = demo();
    const notA = nearestPin(
      index,
      { x: 160, y: 72 },
      { reach: 48, accept: (hit) => hit.pin !== 0 },
    );
    expect(notA).toMatchObject({ pin: 1 });
    expect(nearestPin(index, { x: 600, y: 600 }, { reach: 12 })).toBeUndefined();
  });

  it("chipsIn lists each chip touching the rect once", () => {
    const { index, nand, pieceA } = demo();
    const found = chipsIn(index, { x: -10, y: -10, width: 200, height: 60 });
    expect(found.map((item) => item.instanceId).toSorted()).toEqual(
      [pieceA.id, nand.id].toSorted(),
    );
    expect(found.find((item) => item.instanceId === nand.id)?.rect).toEqual({
      x: 160,
      y: 40,
      width: 120,
      height: 80,
    });
  });
});

describe("index locality", () => {
  it("a lookup among 300 chips touches only nearby entries", () => {
    const { scene } = demo();
    const instances = Array.from({ length: 300 }, (_unused, item) =>
      piece({ type: "nand" }, { x: (item % 20) * 160, y: Math.floor(item / 20) * 120 }),
    );
    const index = buildIndex({ project: scene.project, circuit: { ...EMPTY_CIRCUIT, instances } });
    // Each chip is four entries (body and three pins); a 2 x 2 block of buckets holds a few chips.
    expect(candidatesNear(index, { x: 1000, y: 700 }, 12).length).toBeLessThan(40);
  });
});
