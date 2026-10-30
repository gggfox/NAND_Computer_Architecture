import { describe, expect, test } from "vitest";

import { createEngine, RACE_HOLD_PROBABILITY } from "./engine";
import type { Engine, EngineOptions, SettleResult } from "./engine";
import { compileNetlist } from "./netlist";
import type { Netlist, NetlistSource } from "./netlist";

const compile = (source: NetlistSource): Netlist => {
  const result = compileNetlist(source);
  if (!result.ok) {
    expect.unreachable("fixture netlist must compile");
  }
  return result.value;
};

const NAND: NetlistSource = {
  inputCount: 2,
  nands: [{ a: { kind: "input", index: 0 }, b: { kind: "input", index: 1 } }],
  outputs: [{ kind: "nand", index: 0 }],
};

const SELF_LOOP: NetlistSource = {
  inputCount: 0,
  nands: [{ a: { kind: "nand", index: 0 }, b: { kind: "nand", index: 0 } }],
  outputs: [{ kind: "nand", index: 0 }],
};

// Inputs: 0 = S̄, 1 = R̄. Outputs: 0 = Q (nand 0), 1 = Q̄ (nand 1).
const SR_LATCH: NetlistSource = {
  inputCount: 2,
  nands: [
    { a: { kind: "input", index: 0 }, b: { kind: "nand", index: 1 } },
    { a: { kind: "input", index: 1 }, b: { kind: "nand", index: 0 } },
  ],
  outputs: [
    { kind: "nand", index: 0 },
    { kind: "nand", index: 1 },
  ],
};

// NOT(NOT(in)): the second NAND sees the first one's output one tick later.
const NOT_NOT: NetlistSource = {
  inputCount: 1,
  nands: [
    { a: { kind: "input", index: 0 }, b: { kind: "input", index: 0 } },
    { a: { kind: "nand", index: 0 }, b: { kind: "nand", index: 0 } },
  ],
  outputs: [{ kind: "nand", index: 1 }],
};

const notNotChain = (): Engine => createEngine(compile(NOT_NOT), 1, { raceHoldProbability: 0 });

const releaseLatch = (
  seed: number,
  options?: EngineOptions,
): { readonly engine: Engine; readonly result: SettleResult } => {
  const engine = createEngine(compile(SR_LATCH), seed, options);
  engine.setInput(0, 0);
  engine.setInput(1, 0);
  engine.runUntilStable(500);
  engine.setInput(0, 1);
  engine.setInput(1, 1);
  return { engine, result: engine.runUntilStable(500) };
};

describe("createEngine logic", () => {
  test("RACE_HOLD_PROBABILITY is 1/8", () => {
    expect(RACE_HOLD_PROBABILITY).toBe(0.125);
  });

  test.each([
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ] as const)("NAND(%i, %i) settles to 1 - (a & b)", (a, b) => {
    const engine = createEngine(compile(NAND), 3);
    engine.setInput(0, a);
    engine.setInput(1, b);
    const result = engine.runUntilStable(10);
    expect(result.stable).toBe(true);
    expect(engine.readOutput(0)).toBe(1 - a * b);
  });

  test("tick reads only the previous tick's signals (one-tick gate delay)", () => {
    const engine = notNotChain();
    engine.setInput(0, 1);
    engine.tick();
    // Tick 1: nand0 stays 0 (1 - (1 & 1)); nand1 reads nand0 = 0 from tick 0 and becomes 1.
    expect(engine.readOutput(0)).toBe(1);
    engine.tick();
    engine.setInput(0, 0);
    engine.tick();
    // Tick 3: nand0 becomes 1, but nand1 still reads the old nand0 = 0.
    expect(engine.readOutput(0)).toBe(1);
    engine.tick();
    expect(engine.readOutput(0)).toBe(0);
  });

  test("tickCount counts ticks from tick() and runUntilStable()", () => {
    const engine = notNotChain();
    engine.tick();
    // Tick 2 flips nand1 to 0; tick 3 is the first quiet one.
    expect(engine.runUntilStable(10)).toEqual({ stable: true, ticks: 2 });
    expect(engine.tickCount).toBe(3);
  });
});

describe("createEngine bounds", () => {
  test("a self-loop NAND oscillates and runUntilStable is bounded", () => {
    const engine = createEngine(compile(SELF_LOOP), 9);
    expect(engine.runUntilStable(200)).toEqual({ stable: false, ticks: 200 });
    expect(engine.tickCount).toBe(200);
  });

  test("runUntilStable(0) runs no ticks", () => {
    const engine = createEngine(compile(NAND), 1);
    expect(engine.runUntilStable(0)).toEqual({ stable: false, ticks: 0 });
  });

  test("out-of-range setInput and readOutput are ignored / read low", () => {
    const engine = createEngine(compile(NAND), 1);
    engine.setInput(2, 1);
    engine.setInput(-1, 1);
    engine.runUntilStable(10);
    expect(engine.readOutput(0)).toBe(1);
    expect(engine.readOutput(5)).toBe(0);
  });
});

describe("SR latch released from S̄ = R̄ = 0", () => {
  test("settles with Q != Q̄", () => {
    const { engine, result } = releaseLatch(1);
    expect(result.stable).toBe(true);
    expect(engine.readOutput(0)).not.toBe(engine.readOutput(1));
  });

  test("the same seed gives the same winner", () => {
    const first = releaseLatch(17);
    const second = releaseLatch(17);
    expect(first.engine.readOutput(0)).toBe(second.engine.readOutput(0));
    expect(first.result).toEqual(second.result);
  });

  test("across seeds 1..50 both Q = 0 and Q = 1 occur, all stable", () => {
    const runs = Array.from({ length: 50 }, (_unused, offset) => releaseLatch(offset + 1));
    expect(runs.every(({ result }) => result.stable)).toBe(true);
    const winners = new Set(runs.map(({ engine }) => engine.readOutput(0)));
    expect(winners).toEqual(new Set([0, 1]));
  });

  test("without seeded holds the symmetric race never settles", () => {
    const { result } = releaseLatch(1, { raceHoldProbability: 0 });
    expect(result).toEqual({ stable: false, ticks: 500 });
  });

  test("the clock starts low and setClock drives it", () => {
    const engine = createEngine(
      compile({
        inputCount: 0,
        nands: [{ a: { kind: "clock" }, b: { kind: "clock" } }],
        outputs: [{ kind: "nand", index: 0 }],
      }),
      1,
      { raceHoldProbability: 0 },
    );
    engine.runUntilStable(10);
    expect(engine.readOutput(0)).toBe(1);
    engine.setClock(1);
    engine.runUntilStable(10);
    expect(engine.readOutput(0)).toBe(0);
  });
});
