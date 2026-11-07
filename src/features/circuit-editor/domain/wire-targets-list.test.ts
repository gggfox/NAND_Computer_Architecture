/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { createDemoProject, EMPTY_CIRCUIT, piece, pinDef, wire } from "~/features/projects";
import type { Circuit, PinRef } from "~/features/projects";
import { newInstanceId } from "~/shared/ids";

import type { Scene } from "./geometry";
import { fastestCpuMs, PERF_TIMEOUT_MS } from "./perf.fixtures";
import { inputPieces, partOf, savedChip, sceneOf } from "./suggest-builders.fixtures";
import { bigScene } from "./suggest-wires.fixtures";
import { wireTargets } from "./wire-targets-list";

const NAND_OUT = 2;

/** The demo circuit; `keep` chooses which of its three wires stay. */
const demo = (keep: (index: number) => boolean): Scene => {
  const project = createDemoProject("demo");
  const circuit = project.chips[0]?.draft ?? EMPTY_CIRCUIT;
  const wires = circuit.wires.filter((_wire, index) => keep(index));
  const open: Circuit = { ...circuit, wires };
  return { project: { ...project, chips: [{ ...project.chips[0]!, draft: open }] }, circuit: open };
};

const refAt = (scene: Scene, index: number, pin: number): PinRef => ({
  instanceId: scene.circuit.instances[index]?.id ?? newInstanceId(),
  pin,
});

const labels = (scene: Scene, from: PinRef): readonly string[] =>
  wireTargets(scene, from).map((target) => target.label);

describe("the demo circuit", () => {
  it("lists NAND a and b for Input A out when nothing is wired", () => {
    const scene = demo(() => false);
    expect(labels(scene, refAt(scene, 0, 0))).toEqual([
      "a of NAND gate 1",
      "OUT of OUT",
      "b of NAND gate 1",
    ]);
  });

  it("does not list a pin that already has a wire", () => {
    const scene = demo((index) => index === 1);
    expect(labels(scene, refAt(scene, 0, 0))).toEqual(["a of NAND gate 1", "OUT of OUT"]);
  });

  it("lists nothing for Input A out when the whole circuit is wired", () => {
    const scene = demo(() => true);
    expect(wireTargets(scene, refAt(scene, 0, 0))).toEqual([]);
  });
});

describe("the demo circuit, from other pins", () => {
  it("lists only free source outputs for an input pin of NAND", () => {
    const scene = demo(() => false);
    expect(labels(scene, refAt(scene, 2, 0))).toEqual(["A of Input A", "B of Input B"]);
  });

  it("lists the legal drivers for an output piece", () => {
    const scene = demo(() => false);
    expect(labels(scene, refAt(scene, 3, 0))).toEqual([
      "A of Input A",
      "out of NAND gate 1",
      "B of Input B",
    ]);
  });

  it("does not list the pins of the same part (a loop)", () => {
    const scene = demo(() => false);
    expect(labels(scene, refAt(scene, 2, NAND_OUT))).toEqual(["OUT of OUT"]);
  });

  it("does not list an output for an output", () => {
    const scene = demo(() => false);
    expect(labels(scene, refAt(scene, 0, 0))).not.toContain("A of Input A");
  });

  it("does not change the scene", () => {
    const scene = demo(() => false);
    const before = structuredClone(scene.circuit);
    const { circuit } = scene;
    wireTargets(scene, refAt(scene, 0, 0));
    expect(scene.circuit).toBe(circuit);
    expect(scene.circuit).toEqual(before);
  });
});

describe("widths and bits", () => {
  const sink = savedChip("Sink", [["x", 4]], []);
  const one = savedChip("One", [["y"]], []);

  it("leaves out a pin of another width", () => {
    const pin = pinDef("s", "input", 8);
    const scene = sceneOf([sink], [partOf(sink), ...inputPieces([pin])], { pins: [pin] });
    expect(wireTargets(scene, refAt(scene, 1, 0))).toEqual([]);
  });

  it("asks for a bit on a bus target when the source is one bit", () => {
    const pin = pinDef("s", "input");
    const scene = sceneOf([sink], [partOf(sink), ...inputPieces([pin])], { pins: [pin] });
    const [target] = wireTargets(scene, refAt(scene, 1, 0));
    expect(target).toMatchObject({ label: "x[4] of Sink 1", width: 4, bits: 4 });
  });

  it("asks for no bit when a bus meets a bus of the same width", () => {
    const pin = pinDef("s", "input", 4);
    const scene = sceneOf([sink], [partOf(sink), ...inputPieces([pin])], { pins: [pin] });
    const [target] = wireTargets(scene, refAt(scene, 1, 0));
    expect(target).toMatchObject({ width: 4, bits: 1 });
  });

  it("asks for no bit on a one-bit target when the source is a bus", () => {
    const pin = pinDef("s", "input", 4);
    const scene = sceneOf([one], [partOf(one), ...inputPieces([pin])], { pins: [pin] });
    const [target] = wireTargets(scene, refAt(scene, 1, 0));
    expect(target).toMatchObject({ label: "y of One 1", width: 1, bits: 1 });
  });

  it("lists a bus input pin for a bus source", () => {
    const pin = pinDef("s", "input", 4);
    const scene = sceneOf([sink], [partOf(sink), ...inputPieces([pin])], { pins: [pin] });
    expect(wireTargets(scene, refAt(scene, 1, 0))).toHaveLength(1);
  });
});

describe("order and driven pins", () => {
  it("lists the parts in reading order", () => {
    const pin = pinDef("s", "input");
    const low = piece({ type: "nand" }, { x: 0, y: 400 });
    const high = piece({ type: "nand" }, { x: 0, y: 0 });
    const scene = sceneOf([], [low, high, ...inputPieces([pin])], { pins: [pin] });
    const targets = wireTargets(scene, refAt(scene, 2, 0));
    expect(targets.map((target) => target.ref.instanceId)).toEqual([
      high.id,
      high.id,
      low.id,
      low.id,
    ]);
  });

  it("leaves out an input that a wire drives", () => {
    const pin = pinDef("s", "input");
    const nand = piece({ type: "nand" }, { x: 0, y: 0 });
    const [source] = inputPieces([pin]);
    const wired = wire(
      { instanceId: source?.id ?? nand.id, pin: 0 },
      { instanceId: nand.id, pin: 0 },
    );
    const scene = sceneOf([], [nand, ...inputPieces([pin])], { pins: [pin], wires: [wired] });
    expect(wireTargets(scene, refAt(scene, 1, 0))).toHaveLength(1);
  });
});

describe("a large circuit", () => {
  it("lists targets within a frame", { timeout: PERF_TIMEOUT_MS }, () => {
    const { scene, clk } = bigScene();
    const from: PinRef = { instanceId: clk.id, pin: 0 };
    const budget = 16;
    expect(wireTargets(scene, from).length).toBeGreaterThan(0);
    const time = fastestCpuMs(7, () => {
      wireTargets(scene, from);
    });
    expect(time).toBeLessThan(budget);
  });
});
