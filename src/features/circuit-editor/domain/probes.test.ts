import { describe, expect, it } from "vitest";

import { createDemoProject, pinDef, pinPiece, piece, wire } from "~/features/projects";

import { probeLevels, withProbes } from "./probes";
import { pinLevelKey } from "./signals";
import { toNetlistSource } from "./to-netlist-source";
import type { Flattened } from "./to-netlist-source";
import { CLOCK, end, input, io, nandRef, pick, single } from "./to-netlist-source.fixtures";

const flatten = (project: ReturnType<typeof createDemoProject>): Flattened => {
  const result = toNetlistSource(project, project.lastOpenedChipId);
  expect(result.ok).toBe(true);
  return result.ok ? result.value : expect.unreachable();
};

/** The demo and its parts: pieces A and B, the NAND and piece OUT. */
const demo = () => {
  const project = createDemoProject("x");
  const parts = project.chips[0]?.draft.instances ?? [];
  const part = (index: number) => pick(parts, index);
  return { project, pieceA: part(0), pieceB: part(1), nand: part(2), pieceOut: part(3) };
};

describe("toNetlistSource probes", () => {
  it("lists every pin on the open chip with the signal behind each bit", () => {
    const { project, pieceA, pieceB, nand, pieceOut } = demo();
    expect(flatten(project).probes).toEqual([
      { instanceId: pieceA.id, pin: 0, bits: [input(0)] },
      { instanceId: pieceB.id, pin: 0, bits: [input(1)] },
      { instanceId: nand.id, pin: 0, bits: [input(0)] },
      { instanceId: nand.id, pin: 1, bits: [input(1)] },
      { instanceId: nand.id, pin: 2, bits: [nandRef(0)] },
      { instanceId: pieceOut.id, pin: 0, bits: [nandRef(0)] },
    ]);
  });

  it("leaves out unconnected pins and pieces with no pin definition", () => {
    const pins = io([], ["Y"]);
    // An unused MERGE is valid, but none of its pins resolves.
    const [clock, idle] = [piece({ type: "clock" }), piece({ type: "merge", width: 4 })];
    const dangling = pinPiece(pinDef("gone", "input"));
    const wires = [wire(end(clock), end(pins.piece("Y")))];
    const { project } = single({ pins, parts: [clock, idle, dangling], wires });
    const { probes } = flatten(project);
    expect(probes.map((probe) => [probe.instanceId, probe.pin])).toEqual([
      [pins.piece("Y").id, 0],
      [clock.id, 0],
    ]);
    expect(probes.some((probe) => probe.instanceId === idle.id)).toBe(false);
    expect(probes[0]?.bits).toEqual([CLOCK]);
  });
});

describe("withProbes", () => {
  it("appends each distinct signal once, reusing the outputs' own slots", () => {
    const { project, pieceA, nand } = demo();
    const probed = withProbes(flatten(project));
    expect(probed.source.outputs).toEqual([nandRef(0), input(0), input(1)]);
    expect(probed.slots).toContainEqual({ instanceId: pieceA.id, pin: 0, indices: [1] });
    expect(probed.slots).toContainEqual({ instanceId: nand.id, pin: 0, indices: [1] });
    expect(probed.slots).toContainEqual({ instanceId: nand.id, pin: 2, indices: [0] });
  });

  it("keeps a repeated output in its first slot", () => {
    const { project, nand } = demo();
    const flattened = flatten(project);
    const doubled = { ...flattened.source, outputs: [nandRef(0), nandRef(0)] };
    const probed = withProbes({ ...flattened, source: doubled });
    expect(probed.source.outputs).toHaveLength(4);
    expect(probed.slots).toContainEqual({ instanceId: nand.id, pin: 2, indices: [0] });
  });
});

describe("probeLevels", () => {
  it("packs each slot's bits, bit 0 first; a missing bit reads as 0", () => {
    const { pieceA, nand } = demo();
    const slots = [
      { instanceId: pieceA.id, pin: 0, indices: [2, 0, 1, 9] },
      { instanceId: nand.id, pin: 2, indices: [1] },
    ];
    const levels = probeLevels(slots, [1, 0, 1]);
    expect(levels.get(pinLevelKey(pieceA.id, 0))).toBe(0b0011);
    expect(levels.get(pinLevelKey(nand.id, 2))).toBe(0);
  });
});
