import { assert, describe, expect, it } from "vitest";

import { createDemoProject } from "~/features/projects";
import type { Circuit, Wire } from "~/features/projects";
import { newInstanceId, newWireId } from "~/shared/ids";

import { instanceLevel, wireDash, wireLevel } from "./signals";

const demo = (): Circuit => createDemoProject("x").rootCircuit;

const wiresOf = (circuit: Circuit): readonly [Wire, Wire, Wire] => {
  const [toA, toB, toOut] = circuit.wires;
  assert(toA !== undefined && toB !== undefined && toOut !== undefined);
  return [toA, toB, toOut];
};

describe("signals", () => {
  it("colors input wires by the input level and the NAND wire by the reported output", () => {
    const circuit = demo();
    const [toA, toB, toOut] = wiresOf(circuit);
    const known = { inputs: [1, 0] as const, outputs: [1] as const };
    expect(wireLevel(circuit, known, toA)).toBe(1);
    expect(wireLevel(circuit, known, toB)).toBe(0);
    expect(wireLevel(circuit, known, toOut)).toBe(1);
  });

  it("knows nothing about a NAND output before the engine reports", () => {
    const circuit = demo();
    const toOut = wiresOf(circuit).at(-1);
    assert(toOut !== undefined);
    expect(wireLevel(circuit, { inputs: [0, 0], outputs: [] }, toOut)).toBeUndefined();
  });

  it("knows nothing about a NAND whose output feeds no output part", () => {
    const circuit = demo();
    const [toA, , toOut] = wiresOf(circuit);
    const nandToNand: Wire = { ...toOut, id: newWireId(), to: toA.to };
    const rewired = { ...circuit, wires: [nandToNand] };
    expect(wireLevel(rewired, { inputs: [0, 0], outputs: [1] }, nandToNand)).toBeUndefined();
  });

  it("knows nothing about a wire from a missing part", () => {
    const circuit = demo();
    const [toA] = wiresOf(circuit);
    const ghost: Wire = { ...toA, from: { instanceId: newInstanceId(), pin: 0 } };
    expect(wireLevel(circuit, { inputs: [1, 1], outputs: [0] }, ghost)).toBeUndefined();
  });

  it("shows levels on inputs and outputs only", () => {
    const circuit = demo();
    const known = { inputs: [0, 1] as const, outputs: [1] as const };
    expect(circuit.instances.map((item) => instanceLevel(circuit, known, item))).toEqual([
      0,
      1,
      undefined,
      1,
    ]);
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
