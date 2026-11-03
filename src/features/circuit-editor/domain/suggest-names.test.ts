/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { newChip, pinDef, pinPiece, piece, projectWith, wire } from "~/features/projects";
import type { ChipInstance, Circuit, PinDef } from "~/features/projects";

import { createLayoutCache } from "./chip-layout";
import type { Scene } from "./geometry";
import { endsOf, indexSources, seriesOf, splitName } from "./suggest-names";
import type { End } from "./suggest-names";
import { regChip, registerFileScene } from "./suggest-wires.fixtures";

const ORIGIN = { x: 0, y: 0 };

const sceneWith = (pins: readonly PinDef[], instances: readonly ChipInstance[]): Scene => {
  const circuit: Circuit = { pins, instances, wires: [] };
  return {
    project: projectWith("p", [newChip("Main", circuit)]),
    circuit,
    layout: createLayoutCache(),
  };
};

/** One input piece per definition. */
const piecesOf = (pins: readonly PinDef[]): Scene =>
  sceneWith(
    pins,
    pins.map((def) => pinPiece(def)),
  );

const sourcesOf = (pins: readonly PinDef[]): readonly End[] => endsOf(piecesOf(pins)).sources;

const namesOfEnds = (ends: readonly End[]) => ends.map((end) => end.name);

describe("splitName", () => {
  it.each([
    ["d0", "d", 0],
    ["d_12", "d", 12],
    ["D[3]", "D", 3],
    ["a1b2", "a1b", 2],
  ] as const)("splits %s", (name, stem, index) => {
    expect(splitName(name)).toEqual({ stem, index });
  });

  it.each(["clk", "0", "d[", "[0]", "d_", ""])("does not split %j", (name) => {
    expect(splitName(name)).toBeUndefined();
  });
});

describe("endsOf names and directions", () => {
  it("leaves built-in pins unnamed (D3)", () => {
    const parts = [piece({ type: "nand" }, ORIGIN), piece({ type: "clock" }, ORIGIN)];
    const { sources, sinks } = endsOf(sceneWith([], parts));
    expect(namesOfEnds([...sources, ...sinks])).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(sinks.map((end) => end.ref.pin)).toEqual([0, 1]);
  });

  it("names a custom chip's pins by their definitions, with their direction and width", () => {
    const { scene, regs } = registerFileScene();
    const { sources, sinks } = endsOf(scene);
    const mine = (ends: readonly End[]) => ends.filter((end) => end.ref.instanceId === regs[0]?.id);
    expect(namesOfEnds(mine(sinks))).toEqual(["d0", "d1", "d2", "d3", "load", "clk"]);
    expect(namesOfEnds(mine(sources))).toEqual(["q0", "q1", "q2", "q3"]);
    expect(mine(sinks).every((end) => end.width === 1 && !end.driven)).toBe(true);
  });

  it("treats an input piece as a named source and an output piece as a named sink", () => {
    const [bus, out] = [pinDef("d", "input", 4), pinDef("y", "output")] as const;
    const { sources, sinks } = endsOf(sceneWith([bus, out], [pinPiece(bus), pinPiece(out)]));
    expect(sources).toMatchObject([{ name: "d", width: 4, role: "source" }]);
    expect(sinks).toMatchObject([{ name: "y", width: 1, role: "sink" }]);
  });

  it("leaves a nameless pin and a pin of a missing definition unnamed or out", () => {
    const blank = pinDef("", "input");
    const stray = pinPiece(pinDef("gone", "input"));
    const { sources } = endsOf(sceneWith([blank], [pinPiece(blank), stray]));
    expect(namesOfEnds(sources)).toEqual([undefined]);
  });

  it("ignores an unsaved custom chip's pins", () => {
    const unsaved = newChip("U", { pins: [], instances: [], wires: [] });
    const part = piece({ type: "custom", chipId: unsaved.id }, ORIGIN);
    const circuit: Circuit = { pins: [], instances: [part], wires: [] };
    const scene = { project: projectWith("p", [newChip("Main", circuit), unsaved]), circuit };
    expect(endsOf(scene)).toEqual({ sources: [], sinks: [] });
  });
});

describe("endsOf bookkeeping", () => {
  it("marks a sink with a wire on any bit as driven, and never a source", () => {
    const [bus, out] = [pinDef("d", "input"), pinDef("y", "output", 4)] as const;
    const [inPiece, outPiece] = [pinPiece(bus), pinPiece(out)] as const;
    const through = wire(
      { instanceId: inPiece.id, pin: 0 },
      { instanceId: outPiece.id, pin: 0, bit: 2 },
    );
    const circuit: Circuit = { pins: [bus, out], instances: [inPiece, outPiece], wires: [through] };
    const project = projectWith("p", [newChip("Main", circuit)]);
    const { sinks, sources } = endsOf({ project, circuit });
    expect([sinks[0]?.driven, sources[0]?.driven]).toEqual([true, false]);
  });

  it("groups pin pieces together and a custom chip by its instance", () => {
    const { scene, regs, d } = registerFileScene();
    const { sources, sinks } = endsOf(scene);
    const [, second] = regs;
    const sink = sinks.find((end) => end.ref.instanceId === second?.id);
    expect(sources.find((end) => end.ref.instanceId === d.id)?.group).toBe("pieces");
    expect(sink?.group).toBe(second?.id);
  });

  it("records the instance order", () => {
    const { scene, regs } = registerFileScene();
    const [, second] = regs;
    const sink = endsOf(scene).sinks.find((end) => end.ref.instanceId === second?.id);
    expect(sink?.order).toBe(scene.circuit.instances.findIndex((item) => item.id === second?.id));
  });
});

const dSeries = Array.from({ length: 4 }, (_unused, k) => pinDef(`d${String(k)}`, "input"));

/** Two `Reg` parts and input pieces `d0..d3`. */
const twoRegsAndInputs = (): Scene => {
  const reg = regChip();
  const parts = [1, 2].map(() => piece({ type: "custom", chipId: reg.chip.id }, ORIGIN));
  const circuit: Circuit = {
    pins: dSeries,
    instances: [...parts, ...dSeries.map((def) => pinPiece(def))],
    wires: [],
  };
  return { project: projectWith("p", [newChip("Main", circuit), reg.chip]), circuit };
};

describe("indexSources", () => {
  it("shares one name entry between CLK and clk", () => {
    const index = indexSources(sourcesOf([pinDef("CLK", "input"), pinDef("clk", "input")]));
    expect(index.byName.get("clk")).toHaveLength(2);
  });

  it("makes one series per chip from q0..q3, and one from input pieces d0..d3", () => {
    const index = indexSources(endsOf(twoRegsAndInputs()).sources);
    expect(index.allSeries).toHaveLength(3);
    expect(index.seriesByStem.get("q")).toHaveLength(2);
    expect(index.seriesByStem.get("d")).toHaveLength(1);
  });

  it("orders a series by number and joins the numbers", () => {
    const index = indexSources(endsOf(twoRegsAndInputs()).sources);
    const [series] = index.seriesByStem.get("d") ?? [];
    expect(series?.members.map((member) => member.index)).toEqual([0, 1, 2, 3]);
    expect(series?.numbers).toBe("0,1,2,3");
  });

  it("indexes every source by width", () => {
    const index = indexSources(endsOf(twoRegsAndInputs()).sources);
    expect(index.byWidth.get(1)).toHaveLength(12);
  });

  it("does not make a series of a lone q0, or of repeated numbers", () => {
    const pins = [pinDef("q0", "input"), pinDef("d1", "input"), pinDef("D1", "input")];
    expect(indexSources(sourcesOf(pins)).allSeries).toEqual([]);
  });

  it("leaves unnamed built-in pins out of series", () => {
    const merge = piece({ type: "merge", width: 4 }, ORIGIN);
    const { sinks } = endsOf(sceneWith([], [merge]));
    expect(seriesOf(sinks)).toEqual([]);
  });
});
