import { assert, describe, expect, it } from "vitest";

import { createDemoProject, EMPTY_CIRCUIT } from "~/features/projects";
import type { Circuit, Wire } from "~/features/projects";
import type { PinId } from "~/shared/ids";
import { newInstanceId, newWireId } from "~/shared/ids";

import { instanceLevel, wireDash, wireLevel } from "./signals";
import type { KnownLevels } from "./signals";

const demo = (): Circuit => createDemoProject("x").chips[0]?.draft ?? EMPTY_CIRCUIT;

/** Levels for the demo's pins A, B and OUT; `undefined` leaves a level unknown. */
const levels = (
  circuit: Circuit,
  [levelA, levelB]: readonly [number, number],
  out?: number,
): KnownLevels => {
  const [pinA, pinB, pinOut] = circuit.pins;
  assert(pinA !== undefined && pinB !== undefined && pinOut !== undefined);
  return {
    inputs: new Map<PinId, number>([
      [pinA.id, levelA],
      [pinB.id, levelB],
    ]),
    outputs: out === undefined ? new Map() : new Map([[pinOut.id, out]]),
  };
};

const wiresOf = (circuit: Circuit): readonly [Wire, Wire, Wire] => {
  const [toA, toB, toOut] = circuit.wires;
  assert(toA !== undefined && toB !== undefined && toOut !== undefined);
  return [toA, toB, toOut];
};

describe("signals", () => {
  it("colors input wires by the input level and the NAND wire by the reported output", () => {
    const circuit = demo();
    const [toA, toB, toOut] = wiresOf(circuit);
    const known = levels(circuit, [1, 0], 1);
    expect(wireLevel(circuit, known, toA)).toBe(1);
    expect(wireLevel(circuit, known, toB)).toBe(0);
    expect(wireLevel(circuit, known, toOut)).toBe(1);
  });

  it("knows nothing about a NAND output before the engine reports", () => {
    const circuit = demo();
    const toOut = wiresOf(circuit).at(-1);
    assert(toOut !== undefined);
    expect(wireLevel(circuit, levels(circuit, [0, 0]), toOut)).toBeUndefined();
  });

  it("knows nothing about a NAND whose output feeds no output part", () => {
    const circuit = demo();
    const [toA, , toOut] = wiresOf(circuit);
    const nandToNand: Wire = { ...toOut, id: newWireId(), to: toA.to };
    const rewired = { ...circuit, wires: [nandToNand] };
    expect(wireLevel(rewired, levels(circuit, [0, 0], 1), nandToNand)).toBeUndefined();
  });

  it("knows nothing about a wire from a missing part", () => {
    const circuit = demo();
    const [toA] = wiresOf(circuit);
    const ghost: Wire = { ...toA, from: { instanceId: newInstanceId(), pin: 0 } };
    expect(wireLevel(circuit, levels(circuit, [1, 1], 0), ghost)).toBeUndefined();
  });

  it("shows levels on inputs and outputs only", () => {
    const circuit = demo();
    const known = levels(circuit, [0, 1], 1);
    expect(circuit.instances.map((item) => instanceLevel(circuit, known, item))).toEqual([
      0,
      1,
      undefined,
      1,
    ]);
  });
});

describe("signals on multi-bit pins", () => {
  it("knows levels only for 1-bit pieces", () => {
    const circuit = demo();
    const [pinA] = circuit.pins;
    assert(pinA !== undefined);
    const wide: Circuit = { ...circuit, pins: [{ ...pinA, width: 4 }, ...circuit.pins.slice(1)] };
    const known = levels(wide, [5, 1], 1);
    const [toA, toB] = wiresOf(wide);
    expect(wireLevel(wide, known, toA)).toBeUndefined();
    expect(wireLevel(wide, known, toB)).toBe(1);
    expect(wide.instances.map((item) => instanceLevel(wide, known, item))).toEqual([
      undefined,
      1,
      undefined,
      1,
    ]);
  });

  it("an unset input reads as low", () => {
    const circuit = demo();
    const [toA] = wiresOf(circuit);
    const known = { inputs: new Map<PinId, number>(), outputs: new Map<PinId, number>() };
    expect(wireLevel(circuit, known, toA)).toBe(0);
  });
});

describe("wireDash", () => {
  it("dashes low wires so wire state never relies on colour alone", () => {
    expect(wireDash(0).length).toBeGreaterThan(0);
  });

  it("draws high and unknown wires solid", () => {
    expect(wireDash(1)).toEqual([]);
    expect(wireDash()).toEqual([]);
  });
});
