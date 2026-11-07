/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { pinDef, piece, wire } from "~/features/projects";
import type { PinRef } from "~/features/projects";

import { fastestCpuMs } from "./perf.fixtures";
import { inputPieces, partOf, sceneOf, savedChip, shown } from "./suggest-builders.fixtures";
import { suggestWires } from "./suggest-wires";
import { bigScene, registerFileScene } from "./suggest-wires.fixtures";

const sinkChip = savedChip("Sink", [["clk"]], []);

describe("the register file", () => {
  it("proposes 4 clk wires and 16 bits of d, and nothing into load", () => {
    const { scene } = registerFileScene();
    const wires = shown(scene, suggestWires(scene));
    expect(wires).toHaveLength(20);
    expect(wires.filter((item) => item.startsWith("1.clk"))).toHaveLength(4);
    expect(wires.filter((item) => item.startsWith("0.d["))).toHaveLength(16);
    expect(wires.some((item) => item.endsWith("load"))).toBe(false);
  });

  it("wires bit k of d into dk, register by register, in reading order", () => {
    const { scene } = registerFileScene();
    const bits = shown(scene, suggestWires(scene)).filter((item) => item.startsWith("0.d"));
    const expected = [6, 7, 8, 9].flatMap((reg) =>
      [0, 1, 2, 3].map((bit) => `0.d[${String(bit)}] > ${String(reg)}.d${String(bit)}`),
    );
    expect(bits).toEqual(expected);
  });

  it("keeps only the proposals on a selected chip", () => {
    const { scene, regs } = registerFileScene();
    const [first] = regs;
    const scoped = suggestWires(scene, new Set(first === undefined ? [] : [first.id]));
    expect(scoped).toHaveLength(5);
    expect(scoped.every(({ to }) => to.instanceId === first?.id)).toBe(true);
  });

  it("keeps a proposal whose source end is on the selected chip", () => {
    const { scene, d: bus } = registerFileScene();
    expect(suggestWires(scene, new Set([bus.id]))).toHaveLength(16);
  });

  it("does not change the scene", () => {
    const { scene } = registerFileScene();
    const before = structuredClone(scene.circuit);
    const { circuit } = scene;
    suggestWires(scene);
    expect(scene.circuit).toBe(circuit);
    expect(scene.circuit).toEqual(before);
  });
});

describe("rule 1: the same name", () => {
  it("matches case-insensitively", () => {
    const upper = pinDef("CLK", "input");
    const scene = sceneOf([sinkChip], [partOf(sinkChip), ...inputPieces([upper])], {
      pins: [upper],
    });
    expect(shown(scene, suggestWires(scene))).toEqual(["1.CLK > 0.clk"]);
  });

  it("ignores a same-named source of the wrong width (D4)", () => {
    const pins = [pinDef("clk", "input"), pinDef("clk", "input", 4)];
    const scene = sceneOf([sinkChip], [partOf(sinkChip), ...inputPieces(pins)], { pins });
    expect(shown(scene, suggestWires(scene))).toEqual(["1.clk > 0.clk"]);
  });

  it("leaves a sink alone when two sources share its name", () => {
    const pins = [pinDef("clk", "input"), pinDef("Clk", "input")];
    const scene = sceneOf([sinkChip], [partOf(sinkChip), ...inputPieces(pins)], { pins });
    expect(suggestWires(scene)).toEqual([]);
  });

  it("does not match unnamed built-in pins (D3)", () => {
    const named = pinDef("a", "input");
    const nands = [0, 1, 2].map((row) => piece({ type: "nand" }, { x: 0, y: row * 100 }));
    const scene = sceneOf([], [...inputPieces([named]), ...nands], { pins: [named] });
    expect(suggestWires(scene)).toEqual([]);
  });
});

describe("rule 3: the only legal option", () => {
  const sink = savedChip("Sink", [["i", 4]], []);
  const source = savedChip("Source", [], [["o", 4]]);

  it("proposes the one source of the sink's width on another chip", () => {
    const scene = sceneOf([source, sink], [partOf(source), partOf(sink, 300)]);
    expect(shown(scene, suggestWires(scene))).toEqual(["0.o > 1.i"]);
  });

  it("proposes nothing when a second source has that width", () => {
    const scene = sceneOf([source, sink], [partOf(source), partOf(source, 150), partOf(sink, 300)]);
    expect(suggestWires(scene)).toEqual([]);
  });

  it("never counts the bits of a bus for a one-bit sink", () => {
    const bit = savedChip("Bit", [["z"]], []);
    const scene = sceneOf([source, bit], [partOf(source), partOf(bit, 300)]);
    expect(suggestWires(scene)).toEqual([]);
  });

  it("judges uniqueness on the whole chip, not on the selection (D2)", () => {
    const parts = [partOf(source), partOf(source, 150), partOf(sink, 300)] as const;
    const scene = sceneOf([source, sink], parts);
    expect(suggestWires(scene, new Set([parts[0].id, parts[2].id]))).toEqual([]);
  });

  it("orders proposals by the sinks' reading order, not instance order", () => {
    const parts = [partOf(source), partOf(sink, 400), partOf(sink, 0)] as const;
    const scene = sceneOf([source, sink], parts);
    expect(shown(scene, suggestWires(scene))).toEqual(["0.o > 2.i", "0.o > 1.i"]);
  });
});

describe("only unconnected sinks", () => {
  const sink = savedChip("Sink", [["i", 4]], []);
  const source = savedChip("Source", [], [["o", 4]]);

  it("leaves a wired sink alone", () => {
    const [from, to] = [partOf(source), partOf(sink, 300)] as const;
    const [out, input] = [source.saved?.pins[0], sink.saved?.pins[0]];
    const ends: readonly PinRef[] = [
      { instanceId: from.id, pin: out?.id ?? 0 },
      { instanceId: to.id, pin: input?.id ?? 0 },
    ];
    const [start, end] = ends;
    const wired = start && end ? [wire(start, end, 4)] : [];
    const scene = sceneOf([source, sink], [from, to], { wires: wired });
    expect(wired).toHaveLength(1);
    expect(suggestWires(scene)).toEqual([]);
  });

  it("leaves a sink with one bit wired alone", () => {
    const bit = pinDef("b", "input");
    const [bitPiece] = inputPieces([bit]);
    const target = partOf(sink, 300);
    const input = sink.saved?.pins[0];
    const wired =
      bitPiece === undefined || input === undefined
        ? []
        : [
            wire(
              { instanceId: bitPiece.id, pin: 0 },
              { instanceId: target.id, pin: input.id, bit: 1 },
            ),
          ];
    const scene = sceneOf([sink, source], [target, partOf(source), ...inputPieces([bit])], {
      pins: [bit],
      wires: wired,
    });
    expect(wired).toHaveLength(1);
    expect(suggestWires(scene)).toEqual([]);
  });
});

describe("a big chip", () => {
  it("proposes 40 clk wires and 160 bits of d", () => {
    expect(suggestWires(bigScene().scene)).toHaveLength(200);
  });

  it("stays well inside a frame budget even under coverage", () => {
    const { scene } = bigScene();
    const budget = 200;
    const time = fastestCpuMs(5, () => {
      suggestWires(scene);
    });
    expect(time).toBeLessThan(budget);
  });
});
