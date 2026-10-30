import { assert, describe, expect, it } from "vitest";

import { createDemoProject, EMPTY_CIRCUIT, pinDef, pinPiece } from "~/features/projects";
import type { PinId } from "~/shared/ids";
import { newInstanceId } from "~/shared/ids";

import type { Scene } from "./geometry";
import { pinInfo } from "./pin-info";
import { pinLevelKey } from "./signals";
import type { KnownLevels } from "./signals";

const demo = () => {
  const project = createDemoProject("x");
  const circuit = project.chips[0]?.draft ?? EMPTY_CIRCUIT;
  const [pieceA, , nand] = circuit.instances;
  assert(pieceA !== undefined && nand !== undefined);
  const scene: Scene = { project, circuit };
  return { scene, pieceA, nand };
};

const nothingKnown: KnownLevels = {
  inputs: new Map<PinId, number>(),
  outputs: new Map<PinId, number>(),
};

describe("pinInfo", () => {
  it("names the pin, its value and what it connects to", () => {
    const { scene, nand } = demo();
    const known = { ...nothingKnown, levels: new Map([[pinLevelKey(nand.id, 2), 1]]) };
    expect(pinInfo(scene, known, [nand.id, 2])).toEqual({
      name: "out",
      width: 1,
      value: 1,
      valueText: "1",
      connections: [{ chip: "OUT", pin: "OUT" }],
    });
    expect(pinInfo(scene, nothingKnown, [nand.id, 0])).toEqual({
      name: "a",
      width: 1,
      valueText: "?",
      connections: [{ chip: "A", pin: "A" }],
    });
  });

  it("shows a bus as bits, most significant first, and its decimal value", () => {
    const { scene } = demo();
    const bus = pinDef("d", "input", 4);
    const busPiece = pinPiece(bus);
    const circuit = {
      ...scene.circuit,
      pins: [...scene.circuit.pins, bus],
      instances: [...scene.circuit.instances, busPiece],
    };
    const known = { ...nothingKnown, levels: new Map([[pinLevelKey(busPiece.id, 0), 5]]) };
    expect(pinInfo({ ...scene, circuit }, known, [busPiece.id, 0])).toMatchObject({
      name: "d[4]",
      width: 4,
      valueText: "0101 = 5",
      connections: [],
    });
  });
});

describe("pinInfo connections", () => {
  it("labels a bit tap and skips wires to missing parts", () => {
    const { scene, pieceA, nand } = demo();
    const [toA, ...rest] = scene.circuit.wires;
    assert(toA !== undefined);
    const tapped = { ...toA, to: { ...toA.to, bit: 2 } };
    const dangling = { ...toA, id: toA.id, from: { instanceId: newInstanceId(), pin: 0 } };
    const circuit = { ...scene.circuit, wires: [tapped, dangling, ...rest] };
    expect(pinInfo({ ...scene, circuit }, nothingKnown, [pieceA.id, 0])?.connections).toEqual([
      { chip: "NAND", pin: "a.2" },
    ]);
    const unknownPin = { ...toA, to: { instanceId: nand.id, pin: 9 } };
    const odd = { ...scene.circuit, wires: [unknownPin] };
    expect(pinInfo({ ...scene, circuit: odd }, nothingKnown, [pieceA.id, 0])?.connections).toEqual([
      { chip: "NAND", pin: "9" },
    ]);
  });

  it("is undefined for a missing instance or pin", () => {
    const { scene, nand } = demo();
    expect(pinInfo(scene, nothingKnown, [newInstanceId(), 0])).toBeUndefined();
    expect(pinInfo(scene, nothingKnown, [nand.id, 7])).toBeUndefined();
  });
});
