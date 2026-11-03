/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { createDemoProject, EMPTY_CIRCUIT, piece, pinDef, pinPiece } from "~/features/projects";
import type { ChipInstance, Circuit, PinRef, Point } from "~/features/projects";
import { newChipId, newInstanceId } from "~/shared/ids";

import type { Scene } from "./geometry";
import { appendPins, hasPin, samePinOn, togglePinIn } from "./pin-selection";

const [one, two, three] = [newInstanceId(), newInstanceId(), newInstanceId()];
const ref = (instanceId = one, pin: PinRef["pin"] = 0): PinRef => ({ instanceId, pin });

const sceneOf = (instances: readonly ChipInstance[]): Scene => ({
  project: createDemoProject("x"),
  circuit: { ...EMPTY_CIRCUIT, instances },
});

const nandAt = (position: Point): ChipInstance => piece({ type: "nand" }, position);

describe("togglePinIn", () => {
  it("appends a pin, and takes it out again, keeping the order of the others", () => {
    const added = togglePinIn(togglePinIn([], ref(one)), ref(two));
    expect(added).toEqual([ref(one), ref(two)]);
    expect(togglePinIn([...added, ref(three)], ref(one))).toEqual([ref(two), ref(three)]);
  });

  it("drops the bit, and finds the pin whatever bit it came with", () => {
    expect(togglePinIn([], { ...ref(one), bit: 3 })).toEqual([ref(one)]);
    expect(togglePinIn([ref(one)], { ...ref(one), bit: 2 })).toEqual([]);
  });

  it("tells pins on one chip apart", () => {
    expect(togglePinIn([ref(one, 0)], ref(one, 1))).toEqual([ref(one, 0), ref(one, 1)]);
    expect(hasPin([ref(one, 0)], ref(one, 1))).toBe(false);
    expect(hasPin([ref(one, 0)], ref(two, 0))).toBe(false);
    expect(hasPin([ref(one, 0)], ref(one, 0))).toBe(true);
  });
});

describe("appendPins", () => {
  it("skips pins already there and keeps the existing order", () => {
    expect(
      appendPins([ref(two), ref(one)], [ref(one), ref(three), { ...ref(three), bit: 1 }]),
    ).toEqual([ref(two), ref(one), ref(three)]);
  });
});

const SPACING = 120;
const idsOf = (instances: readonly ChipInstance[]) => new Set(instances.map((item) => item.id));
const firstPin = (instances: readonly ChipInstance[]): PinRef => ({
  instanceId: instances[0]?.id ?? one,
  pin: 0,
});
const orderOf = (pins: readonly PinRef[]) => pins.map((item) => item.instanceId);

/** A 4 x 4 Array of NANDs, row by row. */
const grid = (): ChipInstance[] =>
  Array.from({ length: 16 }, (_, index) =>
    nandAt({ x: (index % 4) * SPACING, y: Math.floor(index / 4) * SPACING }),
  );

describe("samePinOn in reading order", () => {
  it("gives one pin per chip, row by row", () => {
    const instances = grid();
    const found = samePinOn(sceneOf(instances), {
      like: firstPin(instances),
      instanceIds: idsOf(instances),
    });
    expect(found).toEqual(instances.map((item) => ({ instanceId: item.id, pin: 0 })));
  });

  it("follows the positions, not the instance order", () => {
    const [top, ...rest] = grid();
    const moved = [{ ...nandAt({ x: 0, y: 4 * SPACING }), id: top?.id ?? one }, ...rest];
    const found = samePinOn(sceneOf(moved), { like: firstPin(moved), instanceIds: idsOf(moved) });
    expect(found).toHaveLength(16);
    expect(orderOf(found).at(-1)).toBe(top?.id);
  });

  it("breaks ties by instance order", () => {
    const [a, b] = [nandAt({ x: 0, y: 0 }), nandAt({ x: 0, y: 0 })];
    const found = samePinOn(sceneOf([b, a]), {
      like: { instanceId: a.id, pin: 0 },
      instanceIds: idsOf([a, b]),
    });
    expect(orderOf(found)).toEqual([b.id, a.id]);
  });
});

describe("samePinOn skips", () => {
  it("unselected chips, chips of another kind and chips without the key", () => {
    const [a, b, c] = [nandAt({ x: 0, y: 0 }), nandAt({ x: 0, y: 200 }), nandAt({ x: 0, y: 400 })];
    const clock = piece({ type: "clock" }, { x: 200, y: 0 });
    const scene = sceneOf([a, b, c, clock]);
    const like = { instanceId: a.id, pin: 0 };
    const found = samePinOn(scene, { like, instanceIds: idsOf([a, c, clock]) });
    expect(orderOf(found)).toEqual([a.id, c.id]);
    const missing = samePinOn(scene, { like: { ...like, pin: 99 }, instanceIds: idsOf([a, b]) });
    expect(missing).toEqual([]);
  });

  it("a chip that is not in the circuit", () => {
    const instances = grid();
    const found = samePinOn(sceneOf(instances), { like: ref(), instanceIds: idsOf(instances) });
    expect(found).toEqual([]);
  });
});

describe("samePinOn matches the kind", () => {
  const [chipA, chipB] = [newChipId(), newChipId()];
  const [input, output] = [pinDef("A", "input"), pinDef("B", "output")];
  const pieces = [
    piece({ type: "custom", chipId: chipA }, { x: 0, y: 0 }),
    piece({ type: "custom", chipId: chipA }, { x: 0, y: 200 }),
    piece({ type: "custom", chipId: chipB }, { x: 0, y: 400 }),
    piece({ type: "split", width: 4 }, { x: 300, y: 0 }),
    piece({ type: "split", width: 8 }, { x: 300, y: 200 }),
    piece({ type: "split", width: 4 }, { x: 300, y: 400 }),
    piece({ type: "merge", width: 4 }, { x: 300, y: 600 }),
    pinPiece(input),
    pinPiece(input),
    pinPiece(output),
  ];
  const circuit: Circuit = { pins: [input, output], instances: pieces, wires: [] };
  const scene: Scene = { project: createDemoProject("x"), circuit };

  const countLike = (index: number): number => {
    const like = { instanceId: pieces[index]?.id ?? one, pin: 0 };
    return samePinOn(scene, { like, instanceIds: idsOf(pieces) }).length;
  };

  it("by split width, pin direction and merge versus split", () => {
    expect(countLike(3)).toBe(2);
    expect(countLike(4)).toBe(1);
    expect(countLike(6)).toBe(1);
    expect(countLike(7)).toBe(2);
    expect(countLike(9)).toBe(1);
  });
});
