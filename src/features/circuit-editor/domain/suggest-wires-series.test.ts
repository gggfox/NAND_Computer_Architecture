/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names, `k` a series number */
import { describe, expect, it } from "vitest";

import { pinDef, piece } from "~/features/projects";

import { inputPieces, partOf, sceneOf, savedChip, shown } from "./suggest-builders.fixtures";
import { suggestWires } from "./suggest-wires";

const dIn = savedChip("D", [["d0"], ["d1"], ["d2"], ["d3"]], []);
const qOut = savedChip("Q", [], [["q0"], ["q1"], ["q2"], ["q3"]]);

const between = (from: string, to: string) =>
  [0, 1, 2, 3].map((k) => `${from}${String(k)} > ${to}${String(k)}`);

describe("rule 2: series to series", () => {
  it("joins one chip's q0..q3 to another's d0..d3 index by index", () => {
    const scene = sceneOf([qOut, dIn], [partOf(qOut), partOf(dIn, 400)]);
    expect(shown(scene, suggestWires(scene))).toEqual(between("0.q", "1.d"));
  });

  it("prefers the candidate whose stem matches in the first pass", () => {
    const named = savedChip("A", [], [["d[0]"], ["d[1]"], ["d[2]"], ["d[3]"]]);
    const target = savedChip("T", [["d_0"], ["d_1"], ["d_2"], ["d_3"]], []);
    const scene = sceneOf(
      [named, qOut, target],
      [partOf(named), partOf(qOut, 300), partOf(target, 600)],
    );
    const starts = shown(scene, suggestWires(scene)).map((line) => line.split(" > ")[0]);
    expect(starts).toEqual(["0.d[0]", "0.d[1]", "0.d[2]", "0.d[3]"]);
  });

  it("leaves a series alone when two candidates tie in the second pass", () => {
    const scene = sceneOf([dIn, qOut], [partOf(dIn), partOf(qOut, 300), partOf(qOut, 600)]);
    expect(suggestWires(scene)).toEqual([]);
  });

  it("drops a candidate when any pair of the series is illegal", () => {
    const mixed = savedChip("M", [], [["q0"], ["q1"], ["q2", 8], ["q3"]]);
    const scene = sceneOf([dIn, mixed], [partOf(dIn), partOf(mixed, 300)]);
    expect(suggestWires(scene)).toEqual([]);
  });

  it("never joins a chip to itself", () => {
    const loop = savedChip("L", [["d0"], ["d1"], ["d2"], ["d3"]], [["q0"], ["q1"], ["q2"], ["q3"]]);
    const scene = sceneOf([loop], [partOf(loop)]);
    expect(suggestWires(scene)).toEqual([]);
  });
});

describe("rule 2: series to a bus", () => {
  it("takes bit k of a bus of the same size for sink k", () => {
    const bus = pinDef("d", "input", 4);
    const scene = sceneOf([dIn], [partOf(dIn, 400), ...inputPieces([bus])], { pins: [bus] });
    expect(shown(scene, suggestWires(scene))).toEqual(
      [0, 1, 2, 3].map((k) => `1.d[${String(k)}] > 0.d${String(k)}`),
    );
  });

  it("does not match a bus of another size", () => {
    const bus = pinDef("d", "input", 8);
    const scene = sceneOf([dIn], [partOf(dIn), ...inputPieces([bus])], { pins: [bus] });
    expect(suggestWires(scene)).toEqual([]);
  });

  it("does not match numbers that are not 0..width-1", () => {
    const from1 = savedChip("D1", [["d1"], ["d2"], ["d3"], ["d4"]], []);
    const bus = pinDef("d", "input", 4);
    const scene = sceneOf([from1], [partOf(from1), ...inputPieces([bus])], { pins: [bus] });
    expect(suggestWires(scene)).toEqual([]);
  });

  it("falls through to rule 3 when two buses share the stem (a tie)", () => {
    const buses = [pinDef("d", "input", 4), pinDef("D", "input", 4)];
    const scene = sceneOf([dIn], [partOf(dIn), ...inputPieces(buses)], { pins: buses });
    expect(suggestWires(scene)).toEqual([]);
  });

  it("takes a bus of another name when it is the only candidate (second pass)", () => {
    const bus = pinDef("data", "input", 4);
    const scene = sceneOf([dIn], [partOf(dIn), ...inputPieces([bus])], { pins: [bus] });
    expect(suggestWires(scene)).toHaveLength(4);
  });

  it("leaves an unnamed merge output out of the bus candidates (D3)", () => {
    const merge = piece({ type: "merge", width: 4 }, { x: 0, y: 0 });
    const scene = sceneOf([dIn], [partOf(dIn, 300), merge]);
    expect(suggestWires(scene)).toEqual([]);
  });
});
