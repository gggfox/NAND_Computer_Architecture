import { describe, expect, it } from "vitest";

import type { WireId } from "~/shared/ids";

import type { Scene } from "../geometry";
import { fastestCpuMs, PERF_TIMEOUT_MS } from "../perf.fixtures";
import { rerouted } from "./route";
import { COLUMNS, gridScene } from "./routing.fixtures";

/** Every wire touching the first `count` chips, as a selection drag would re-route them. */
const touching = (scene: Scene, count: number): ReadonlySet<WireId> => {
  const chips = new Set(scene.circuit.instances.slice(0, count).map((item) => item.id));
  return new Set(
    scene.circuit.wires
      .filter((item) => chips.has(item.from.instanceId) || chips.has(item.to.instanceId))
      .map((item) => item.id),
  );
};

const rerouteTime = (chips: number, selected: number): number => {
  const scene = gridScene(chips);
  const wireIds = touching(scene, selected);
  // The warm-up runs let the JIT compile the search before timing.
  return fastestCpuMs(
    RUNS,
    () => {
      expect(rerouted(scene, wireIds).wires).toHaveLength(scene.circuit.wires.length);
    },
    WARM_UPS,
  );
};

/*
 * Measured median on an Apple-silicon laptop (Node 26, 102 wires re-routed): about 17 ms under
 * plain Vitest and about 69 ms under `pnpm test`'s v8 coverage, which is where this runs in CI and
 * pre-push. The budget is 4x the coverage median, so it catches a regression (a lost search
 * window, a flood on every failure, a quadratic scan) without flaking.
 *
 * The test measures the fastest CPU time of the runs (see `fastestCpuMs`), so a busy machine does
 * not change the result. More runs give the fastest run more chances to avoid cache noise.
 */
const RUNS = 9;
const WARM_UPS = 3;
const CHIPS = 300;
const SELECTED = 50;
const REROUTE_50_BUDGET_MS = 280;
/**
 * Twice the circuit and twice the selection: linear gives 2x. Whole rows are selected, since a
 * partial row's share of row-wrapping wires is a step function that skews the ratio.
 */
const MAX_SCALING = 3;
const ROWS = 2;

describe("routing performance budget", () => {
  it("re-routes the wires of a 50-chip selection quickly", { timeout: PERF_TIMEOUT_MS }, () => {
    expect(rerouteTime(CHIPS, SELECTED)).toBeLessThan(REROUTE_50_BUDGET_MS);
  });

  it("scales near-linearly", { timeout: PERF_TIMEOUT_MS }, () => {
    const small = rerouteTime(CHIPS, ROWS * COLUMNS);
    const large = rerouteTime(CHIPS * 2, ROWS * 2 * COLUMNS);
    expect(large / small).toBeLessThan(MAX_SCALING);
  });
});
