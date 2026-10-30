import { describe, expect, it } from "vitest";

import { createDemoProject } from "~/features/projects";
import type { ChipInstance, Circuit, Wire } from "~/features/projects";
import { newChipId, newInstanceId } from "~/shared/ids";

import { toNetlistSource } from "./to-netlist-source";

const demo = (): Circuit => createDemoProject("x").rootCircuit;

const withFirstKind = (circuit: Circuit, kind: ChipInstance["kind"]): Circuit => ({
  ...circuit,
  instances: circuit.instances.map((item, index) => (index === 0 ? { ...item, kind } : item)),
});

describe("toNetlistSource", () => {
  it("maps the demo project to 2 inputs, 1 NAND and 1 output", () => {
    expect(toNetlistSource(demo())).toEqual({
      ok: true,
      value: {
        inputCount: 2,
        nands: [{ a: { kind: "input", index: 0 }, b: { kind: "input", index: 1 } }],
        outputs: [{ kind: "nand", index: 0 }],
      },
    });
  });

  it("reports a custom chip as UnsupportedPart", () => {
    const circuit = withFirstKind(demo(), { type: "custom", chipId: newChipId() });
    const result = toNetlistSource(circuit);
    expect(!result.ok && result.error).toEqual({
      type: "UnsupportedPart",
      instanceId: circuit.instances[0]?.id,
    });
  });

  it("reports the clock as UnsupportedPart", () => {
    const circuit = withFirstKind(demo(), { type: "builtin", builtin: "clock" });
    const result = toNetlistSource(circuit);
    expect(!result.ok && result.error.type).toBe("UnsupportedPart");
  });
});

describe("toNetlistSource unconnected pins", () => {
  it("reports an unwired NAND input", () => {
    const circuit = demo();
    const nandId = circuit.wires[0]?.to.instanceId;
    const result = toNetlistSource({ ...circuit, wires: circuit.wires.slice(1) });
    expect(!result.ok && result.error).toEqual({
      type: "UnconnectedPin",
      instanceId: nandId,
      pin: 0,
    });
  });

  it("reports a half-wired NAND (input b missing)", () => {
    const circuit = demo();
    const wires = circuit.wires.filter((_wire, index) => index !== 1);
    const result = toNetlistSource({ ...circuit, wires });
    expect(!result.ok && result.error.type).toBe("UnconnectedPin");
  });

  it("reports an unwired output", () => {
    const circuit = demo();
    const result = toNetlistSource({ ...circuit, wires: circuit.wires.slice(0, 2) });
    expect(!result.ok && result.error.type).toBe("UnconnectedPin");
  });
});

const withWire = (circuit: Circuit, index: number, patch: (wire: Wire) => Wire): Circuit => ({
  ...circuit,
  wires: circuit.wires.map((wire, at) => (at === index ? patch(wire) : wire)),
});

describe("toNetlistSource pin validation", () => {
  it("rejects a NAND output wired from pin 0 (its input a)", () => {
    const circuit = withWire(demo(), 2, (wire) => ({
      ...wire,
      from: { ...wire.from, pin: 0 },
    }));
    const result = toNetlistSource(circuit);
    expect(!result.ok && result.error).toEqual({
      type: "InvalidWire",
      wireId: circuit.wires[2]?.id,
    });
  });

  it("rejects an input wired from pin 1", () => {
    const circuit = withWire(demo(), 0, (wire) => ({
      ...wire,
      from: { ...wire.from, pin: 1 },
    }));
    const result = toNetlistSource(circuit);
    expect(!result.ok && result.error).toEqual({
      type: "InvalidWire",
      wireId: circuit.wires[0]?.id,
    });
  });

  it("rejects a wire into NAND pin 2 (its output)", () => {
    const circuit = withWire(demo(), 1, (wire) => ({ ...wire, to: { ...wire.to, pin: 2 } }));
    const result = toNetlistSource(circuit);
    expect(!result.ok && result.error.type).toBe("InvalidWire");
  });

  it("rejects a wire into output pin 1", () => {
    const circuit = withWire(demo(), 2, (wire) => ({ ...wire, to: { ...wire.to, pin: 1 } }));
    const result = toNetlistSource(circuit);
    expect(!result.ok && result.error.type).toBe("InvalidWire");
  });
});

describe("toNetlistSource endpoint validation", () => {
  it("rejects a wire from an output part or into an input part", () => {
    const circuit = demo();
    const [inputA] = circuit.instances;
    const output = circuit.instances.find((item) => item.id === circuit.wires[2]?.to.instanceId);
    const fromOutput = withWire(circuit, 0, (wire) => ({
      ...wire,
      from: { instanceId: output?.id ?? wire.from.instanceId, pin: 0 },
    }));
    const intoInput = withWire(circuit, 0, (wire) => ({
      ...wire,
      to: { instanceId: inputA?.id ?? wire.to.instanceId, pin: 0 },
    }));
    expect(toNetlistSource(fromOutput).ok).toBe(false);
    expect(toNetlistSource(intoInput).ok).toBe(false);
  });

  it("rejects a wire whose endpoint instance does not exist", () => {
    const circuit = withWire(demo(), 0, (wire) => ({
      ...wire,
      from: { ...wire.from, instanceId: newInstanceId() },
    }));
    const result = toNetlistSource(circuit);
    expect(!result.ok && result.error.type).toBe("InvalidWire");
  });
});
