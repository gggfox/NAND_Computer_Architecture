import { describe, expect, it } from "vitest";

import { createDemoProject } from "~/features/projects";
import type { ChipInstance, Circuit } from "~/features/projects";
import { newChipId } from "~/shared/ids";

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
