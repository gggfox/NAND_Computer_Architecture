/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import type { ChipInstance } from "~/features/projects";
import { newWireId } from "~/shared/ids";

import { copiesOf, copyOf } from "./clipboard";
import { applyAction } from "./reducer";
import { NAND_A, NAND_OUT, nandAt } from "./routing/routing.fixtures";
import { selectInstances } from "./selection";
import { draftIn, projectOf } from "./wire-edits.fixtures";

/**
 * One 16 ms frame measured without coverage (about 6 ms). Coverage instrumentation makes the same
 * work about 15 times slower, and `pnpm test` runs with coverage, so the guard has headroom.
 */
const BUDGET_MS = 200;
const RUNS = 7;
const SINKS = 64;

const source = nandAt(0, 0);

/** `count` NANDs in a column, made as an Array of one NAND would. */
const column = (count: number): readonly ChipInstance[] => {
  const first = nandAt(400, 0);
  const circuit = { pins: [], instances: [first], wires: [] };
  const clipboard = copyOf(circuit, selectInstances([first.id]), 1);
  assert(clipboard !== undefined);
  const deltas = Array.from({ length: count - 1 }, (_, index) => ({ x: 0, y: (index + 1) * 100 }));
  const copies = copiesOf(clipboard, deltas, { target: circuit, newWireId });
  return [first, ...copies.instances];
};

/** A `connectWires` from the source to input A of every sink, teal. */
const setup = (count: number) => {
  const sinks = column(count);
  const { project, chipId } = projectOf([source, ...sinks], []);
  const wires = sinks.map((sink) => ({
    wireId: newWireId(),
    from: { instanceId: source.id, pin: NAND_OUT },
    to: { instanceId: sink.id, pin: NAND_A },
  }));
  const action = { type: "connectWires", chipId, wires, color: "teal" } as const;
  return { project, action };
};

describe("connectWires", () => {
  it("adds every wire in order, each with its id, colour and a route", () => {
    const { project, action } = setup(16);
    const result = applyAction(project, action);
    assert(result.ok);
    const { wires } = draftIn(result.value, action.chipId);
    expect(wires.map((item) => item.id)).toEqual(action.wires.map((item) => item.wireId));
    expect(wires.map((item) => item.color)).toEqual(Array.from({ length: 16 }, () => "teal"));
    expect(wires.some((item) => item.manualWaypoints)).toBe(false);
    expect(wires.every((item) => item.waypoints.length > 0)).toBe(true);
  });

  it("refuses all of them when the 7th is illegal, leaving the project as it was", () => {
    const { project, action } = setup(16);
    const before = structuredClone(project);
    const sixth = action.wires.at(5);
    assert(sixth !== undefined);
    const wires = action.wires.map((item, index) =>
      index === 6 ? { ...item, to: sixth.to } : item,
    );
    const result = applyAction(project, { ...action, wires });
    const error = { type: "InputAlreadyDriven", instanceId: sixth.to.instanceId };
    expect(result).toEqual({ ok: false, error });
    expect(project).toEqual(before);
  });

  it("refuses a wire id that is already used, in the circuit or earlier in the list", () => {
    const { project, action } = setup(3);
    const [first] = action.wires;
    assert(first !== undefined);
    const repeated = action.wires.map((item, index) =>
      index === 1 ? { ...item, wireId: first.wireId } : item,
    );
    const result = applyAction(project, { ...action, wires: repeated });
    expect(result).toEqual({ ok: false, error: { type: "DuplicateWire", wireId: first.wireId } });
  });

  it("leaves the colour out when none is given", () => {
    const { project, action } = setup(2);
    const { color: _color, ...plain } = action;
    const result = applyAction(project, plain);
    assert(result.ok);
    expect(draftIn(result.value, action.chipId).wires[0]).not.toHaveProperty("color");
  });
});

describe("connectWires refusals", () => {
  it("refuses an empty list", () => {
    const { project, action } = setup(2);
    const result = applyAction(project, { ...action, wires: [] });
    expect(result).toEqual({ ok: false, error: { type: "NothingToConnect" } });
  });
});

const median = (runs: number, work: () => void): number => {
  const times = Array.from({ length: runs }, () => {
    const start = performance.now();
    work();
    return performance.now() - start;
  }).toSorted((a, b) => a - b);
  return times[Math.floor(runs / 2)] ?? Number.NaN;
};

describe("connectWires performance budget", () => {
  it("wires 64 clk-like pins inside the budget", () => {
    const { project, action } = setup(SINKS);
    expect(action.wires).toHaveLength(SINKS);
    const time = median(RUNS, () => {
      expect(applyAction(project, action).ok).toBe(true);
    });
    console.info(`connectWires x${SINKS}: median ${time.toFixed(2)} ms of ${RUNS}`);
    expect(time).toBeLessThan(BUDGET_MS);
  });
});
