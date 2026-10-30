import type { Netlist } from "./netlist";
import { createPrng } from "./prng";

/** Chance that a changing NAND keeps its old value this tick; breaks symmetric races (ADR 15). */
export const RACE_HOLD_PROBABILITY = 0.125;

export interface EngineOptions {
  readonly raceHoldProbability?: number;
}

export interface SettleResult {
  readonly stable: boolean;
  readonly ticks: number;
}

export interface Engine {
  readonly setInput: (index: number, value: 0 | 1) => void;
  readonly setClock: (value: 0 | 1) => void;
  readonly tick: () => void;
  readonly runUntilStable: (maxTicks: number) => SettleResult;
  readonly readOutput: (index: number) => 0 | 1;
  readonly tickCount: number;
}

/** Preallocated simulation state. Only the typed arrays' contents change after creation. */
interface Core {
  readonly netlist: Netlist;
  readonly signals: Uint8Array;
  readonly next: Uint8Array;
  readonly random: () => number;
  readonly holdProbability: number;
}

/** Out-of-range reads are low; keeps the hot loop free of `undefined` branches. */
const at = (array: Int32Array | Uint8Array, index: number): number => array[index] ?? 0;

/** Phase 1: every NAND reads only the previous tick's signals (one-tick gate delay, ADR 2). */
const evaluate = ({ netlist, signals, next }: Core): void => {
  const { nandCount, nandA, nandB } = netlist;
  for (let gate = 0; gate < nandCount; gate += 1) {
    next[gate] = 1 - (at(signals, at(nandA, gate)) & at(signals, at(nandB, gate)));
  }
};

/** Phase 2: commit changes, each held back with a seeded probability. Returns true when quiet. */
const commit = ({ netlist, signals, next, random, holdProbability }: Core): boolean => {
  const { inputCount, nandCount } = netlist;
  let quiet = true;
  for (let gate = 0; gate < nandCount; gate += 1) {
    const value = at(next, gate);
    if (value !== at(signals, inputCount + 1 + gate)) {
      quiet = false;
      if (random() >= holdProbability) {
        signals[inputCount + 1 + gate] = value;
      }
    }
  }
  return quiet;
};

const createCore = (netlist: Netlist, seed: number, options?: EngineOptions): Core => ({
  netlist,
  signals: new Uint8Array(netlist.inputCount + 1 + netlist.nandCount),
  next: new Uint8Array(netlist.nandCount),
  random: createPrng(seed),
  holdProbability: options?.raceHoldProbability ?? RACE_HOLD_PROBABILITY,
});

/**
 * Unit-delay NAND engine. All state is preallocated in typed arrays; `tick` allocates nothing.
 * `runUntilStable` stops at the first tick where nothing changed and nothing was held, and is
 * bounded by `maxTicks`, so oscillating circuits cannot hang the caller.
 */
export const createEngine = (netlist: Netlist, seed: number, options?: EngineOptions): Engine => {
  const core = createCore(netlist, seed, options);
  let tickCount = 0;
  const step = (): boolean => {
    evaluate(core);
    tickCount += 1;
    return commit(core);
  };
  return {
    setInput: (index, value) => {
      if (index >= 0 && index < netlist.inputCount) {
        core.signals[index] = value;
      }
    },
    setClock: (value) => {
      core.signals[netlist.inputCount] = value;
    },
    tick: () => {
      step();
    },
    runUntilStable: (maxTicks) => {
      for (let ticks = 1; ticks <= maxTicks; ticks += 1) {
        if (step()) {
          return { stable: true, ticks };
        }
      }
      return { stable: false, ticks: Math.max(0, maxTicks) };
    },
    readOutput: (index) => (at(core.signals, at(netlist.outputs, index)) === 1 ? 1 : 0),
    get tickCount() {
      return tickCount;
    },
  };
};
