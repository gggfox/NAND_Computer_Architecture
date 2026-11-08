import { assert, describe, expect, it } from "vitest";

import { createDemoProject, EMPTY_CIRCUIT, pinDef, pinPiece, wire } from "~/features/projects";
import type { PinId } from "~/shared/ids";
import { newInstanceId } from "~/shared/ids";

import type { Scene } from "./geometry";
import { bitsText, pinInfo } from "./pin-info";
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
      connections: [expect.objectContaining({ chip: "OUT", pin: "OUT" })],
      usedBits: [],
    });
    expect(pinInfo(scene, nothingKnown, [nand.id, 0])).toEqual({
      name: "a",
      width: 1,
      valueText: "?",
      connections: [expect.objectContaining({ chip: "A", pin: "A" })],
      usedBits: [],
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

describe("bits used", () => {
  it("lists the tapped bits of a bus pin as d0, d2", () => {
    const { scene, pieceA } = demo();
    const bus = pinDef("q", "output", 4);
    const busPiece = pinPiece(bus);
    const taps = [2, 0].map((bit) =>
      wire({ instanceId: pieceA.id, pin: 0 }, { instanceId: busPiece.id, pin: 0, bit }),
    );
    const circuit = {
      ...scene.circuit,
      pins: [...scene.circuit.pins, bus],
      instances: [...scene.circuit.instances, busPiece],
      wires: [...scene.circuit.wires, ...taps],
    };
    const info = pinInfo({ ...scene, circuit }, nothingKnown, [busPiece.id, 0]);
    expect(info?.usedBits).toEqual([0, 2]);
    expect(bitsText(info?.usedBits ?? [])).toBe("d0, d2");
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
      expect.objectContaining({ chip: "NAND", pin: "a.2" }),
    ]);
    const unknownPin = { ...toA, to: { instanceId: nand.id, pin: 9 } };
    const odd = { ...scene.circuit, wires: [unknownPin] };
    expect(pinInfo({ ...scene, circuit: odd }, nothingKnown, [pieceA.id, 0])?.connections).toEqual([
      expect.objectContaining({ chip: "NAND", pin: "9" }),
    ]);
  });

  it("gives each connection its own key when one pin feeds two parts of the same chip", () => {
    const { scene, pieceA, nand } = demo();
    const second = { ...nand, id: newInstanceId() };
    const fanOut = [nand, second].map((target) =>
      wire({ instanceId: pieceA.id, pin: 0 }, { instanceId: target.id, pin: 1 }),
    );
    const circuit = {
      ...scene.circuit,
      instances: [...scene.circuit.instances, second],
      wires: fanOut,
    };
    const connections = pinInfo({ ...scene, circuit }, nothingKnown, [pieceA.id, 0])?.connections;
    expect(connections?.map(({ chip, pin }) => `${chip}.${pin}`)).toEqual(["NAND.b", "NAND.b"]);
    expect(new Set(connections?.map((item) => item.key)).size).toBe(2);
  });

  it("is undefined for a missing instance or pin", () => {
    const { scene, nand } = demo();
    expect(pinInfo(scene, nothingKnown, [newInstanceId(), 0])).toBeUndefined();
    expect(pinInfo(scene, nothingKnown, [nand.id, 7])).toBeUndefined();
  });
});
