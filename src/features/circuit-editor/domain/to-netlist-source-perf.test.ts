import { describe, expect, it } from "vitest";

import { newChip, piece, projectWith, wire } from "~/features/projects";
import type { Chip, ChipInstance, PinKey, PinRef, Project, Wire } from "~/features/projects";

import { fastestCpuMs, PERF_TIMEOUT_MS } from "./perf.fixtures";
import { toNetlistSource } from "./to-netlist-source";
import { end, io, NAND_OUT, nandPart, notChip, pick } from "./to-netlist-source.fixtures";

interface Stage {
  readonly part: ChipInstance;
  readonly sinks: readonly PinKey[];
  readonly out: PinKey;
}

const feed = ({ part, sinks }: Stage, from: PinRef): readonly Wire[] =>
  sinks.map((pin) => wire(from, end(part, pin)));

/** A chip A -> each stage in turn -> Y, every sink of a stage fed by the stage before. */
const pipeline = (name: string, stages: readonly Stage[], saved = false): Chip => {
  const pins = io(["A"], ["Y"]);
  const outputs = stages.map(({ part, out }) => end(part, out));
  const feeds = [end(pins.piece("A")), ...outputs];
  const wires: Wire[] = stages.flatMap((stage, index) => feed(stage, pick(feeds, index)));
  const [last, pieceY] = [pick(feeds, stages.length), pins.piece("Y")];
  wires.push(wire(last, end(pieceY)));
  const parts = stages.map((stage) => stage.part);
  const circuit = { pins: pins.defs, instances: [...pins.pieces, ...parts], wires };
  return newChip(name, circuit, { saved });
};

const nandStage = (): Stage => ({ part: nandPart(), sinks: [0, 1], out: NAND_OUT });

/** An open chip of `count` NANDs in a row, each fed twice by the one before. */
const chain = (count: number): Project =>
  projectWith("chain", [pipeline("chain", Array.from({ length: count }, nandStage))]);

const FAN = 4;

/** Four instances of `inner` in a row, through its saved pins (input first). */
const level = (inner: Chip, name: string, saved: boolean): Chip => {
  const innerPins = inner.saved?.pins ?? [];
  const [innerIn, innerOut] = [pick(innerPins, 0).id, pick(innerPins, 1).id];
  const stage = (): Stage => ({
    part: piece({ type: "custom", chipId: inner.id }),
    sinks: [innerIn],
    out: innerOut,
  });
  return pipeline(name, Array.from({ length: FAN }, stage), saved);
};

/** NOT nested `depth` levels deep, four per level: 4^depth NANDs under an open chip. */
const hierarchy = (depth: number): Project => {
  const chips: Chip[] = [notChip().chip];
  for (let index = 1; index <= depth; index += 1) {
    chips.unshift(level(pick(chips, 0), `L${String(index)}`, index < depth));
  }
  return projectWith("hierarchy", [pick(chips, 0), ...chips.slice(1)]);
};

const flattenTime = (project: Project, runs: number, warmUps: number): number =>
  fastestCpuMs(
    runs,
    () => {
      expect(toNetlistSource(project, project.lastOpenedChipId).ok).toBe(true);
    },
    warmUps,
  );

/*
 * Budgets are a few times the fixed time on a slow container (about 10 ms and 700 ms), so they
 * catch a regression to the old cost (about 230 ms and 2400 ms there) without flaking on CI.
 * The tests measure the fastest CPU time of the runs (see `fastestCpuMs`), so a busy machine does
 * not change the result.
 */
const RUNS = 9;
const WARM_UPS = 3;
const SMALL = 1000;
const LARGE = 4000;
/** Linear scaling gives 4x; the old quadratic cost gave about 16x. */
const MAX_SCALING = 8;
const CHAIN_2000_BUDGET_MS = 80;
const DEEP = 8;
const HIERARCHY_BUDGET_MS = 1500;

describe("flattening performance budget", () => {
  it("is near-linear in the open chip's size", { timeout: PERF_TIMEOUT_MS }, () => {
    const small = flattenTime(chain(SMALL), RUNS, WARM_UPS);
    const large = flattenTime(chain(LARGE), RUNS, WARM_UPS);
    expect(large / small).toBeLessThan(MAX_SCALING);
  });

  it("flattens 2000 NANDs within budget", { timeout: PERF_TIMEOUT_MS }, () => {
    expect(flattenTime(chain(2000), RUNS, WARM_UPS)).toBeLessThan(CHAIN_2000_BUDGET_MS);
  });

  it("flattens a 65k-NAND hierarchy within budget", { timeout: PERF_TIMEOUT_MS }, () => {
    const project = hierarchy(DEEP);
    const result = toNetlistSource(project, project.lastOpenedChipId);
    expect(result.ok ? result.value.source.nands.length : 0).toBe(FAN ** DEEP);
    // The check above already ran the flattening once, so it serves as the only warm-up.
    expect(flattenTime(project, 3, 0)).toBeLessThan(HIERARCHY_BUDGET_MS);
  });
});
