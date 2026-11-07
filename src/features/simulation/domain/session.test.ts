import { describe, expect, test } from "vitest";

import { createEngineSession, SETTLE_TICKS } from "./session";

const NAND_SOURCE = {
  inputCount: 2,
  nands: [{ a: { kind: "input", index: 0 }, b: { kind: "input", index: 1 } }],
  outputs: [{ kind: "nand", index: 0 }],
};

const SELF_LOOP_SOURCE = {
  inputCount: 0,
  nands: [{ a: { kind: "nand", index: 0 }, b: { kind: "nand", index: 0 } }],
  outputs: [{ kind: "nand", index: 0 }],
};

describe("createEngineSession", () => {
  test("load settles and reports outputs", () => {
    const session = createEngineSession();
    expect(session.handle({ type: "load", seed: 1, source: NAND_SOURCE })).toMatchObject({
      type: "state",
      stable: true,
      outputs: [1],
    });
  });

  test("setInput re-settles", () => {
    const session = createEngineSession();
    session.handle({ type: "load", seed: 1, source: NAND_SOURCE });
    session.handle({ type: "setInput", index: 0, value: 1 });
    expect(session.handle({ type: "setInput", index: 1, value: 1 })).toMatchObject({
      type: "state",
      stable: true,
      outputs: [0],
    });
  });

  test("an oscillating load is bounded by SETTLE_TICKS", () => {
    const session = createEngineSession();
    expect(session.handle({ type: "load", seed: 1, source: SELF_LOOP_SOURCE })).toMatchObject({
      type: "state",
      tick: SETTLE_TICKS,
      stable: false,
    });
  });

  test("settle uses the requested tick budget", () => {
    const session = createEngineSession();
    session.handle({ type: "load", seed: 1, source: SELF_LOOP_SOURCE });
    expect(session.handle({ type: "settle", maxTicks: 7 })).toMatchObject({
      type: "state",
      tick: SETTLE_TICKS + 7,
      stable: false,
    });
  });
});

describe("createEngineSession errors", () => {
  test("a compile error is reported and keeps no engine", () => {
    const session = createEngineSession();
    const bad = { ...NAND_SOURCE, outputs: [{ kind: "nand", index: 5 }] };
    expect(session.handle({ type: "load", seed: 1, source: bad })).toEqual({
      type: "error",
      error: { type: "SignalOutOfRange", ref: { kind: "nand", index: 5 } },
    });
    expect(session.handle({ type: "settle", maxTicks: 1 })).toEqual({
      type: "error",
      error: { type: "BadMessage" },
    });
  });

  test.each([
    { type: "setInput", index: 2, value: 1 },
    { type: "setInput", index: 1000, value: 0 },
  ] as const)("%o past the last input is BadMessage and changes nothing", (message) => {
    const session = createEngineSession();
    const first = session.handle({ type: "load", seed: 1, source: NAND_SOURCE });
    expect(session.handle(message)).toEqual({ type: "error", error: { type: "BadMessage" } });
    expect(session.handle({ type: "settle", maxTicks: 1 })).toMatchObject({
      tick: (first.type === "state" ? first.tick : 0) + 1,
      outputs: [1],
    });
  });

  test.each([{ type: "setInput", index: 0, value: 1 }, { type: "nope" }, 42] as const)(
    "%o without a loaded engine or malformed is BadMessage",
    (message) => {
      expect(createEngineSession().handle(message)).toEqual({
        type: "error",
        error: { type: "BadMessage" },
      });
    },
  );
});

// One NAND fed by the clock on both pins: the output is the inverted clock.
const CLOCK_NAND = {
  inputCount: 0,
  nands: [{ a: { kind: "clock" }, b: { kind: "clock" } }],
  outputs: [{ kind: "nand", index: 0 }],
};

const loadedClockSession = () => {
  const session = createEngineSession();
  session.handle({ type: "load", seed: 1, source: CLOCK_NAND });
  return session;
};

describe("createEngineSession clock", () => {
  test("load reports clock 0, not running", () => {
    expect(
      createEngineSession().handle({ type: "load", seed: 1, source: CLOCK_NAND }),
    ).toMatchObject({ type: "state", stable: true, clock: 0, running: false, outputs: [1] });
  });

  test("step toggles the clock once and settles", () => {
    const session = loadedClockSession();
    expect(session.handle({ type: "step" })).toMatchObject({
      type: "state",
      stable: true,
      clock: 1,
      running: false,
      outputs: [0],
    });
    expect(session.handle({ type: "step" })).toMatchObject({ clock: 0, outputs: [1] });
  });

  test("advance runs due steps only while playing", () => {
    const session = loadedClockSession();
    expect(session.advance(1000)).toBeUndefined();
    expect(session.handle({ type: "play" })).toMatchObject({ clock: 0, running: true });
    expect(session.advance(250)).toMatchObject({ clock: 1, running: true, outputs: [0] });
    expect(session.advance(750)).toMatchObject({ clock: 0, running: true, outputs: [1] });
    expect(session.advance(100)).toBeUndefined();
    expect(session.handle({ type: "pause" })).toMatchObject({ clock: 0, running: false });
    expect(session.advance(1000)).toBeUndefined();
  });

  test("setSpeed changes how many steps are due", () => {
    const session = loadedClockSession();
    expect(session.handle({ type: "setSpeed", stepsPerSecond: 10 })).toMatchObject({
      type: "state",
      running: false,
    });
    session.handle({ type: "play" });
    expect(session.advance(100)).toMatchObject({ clock: 1 });
  });
});

describe("createEngineSession clock across loads", () => {
  test("a reload while playing keeps playing and the speed, and resets the clock", () => {
    const session = loadedClockSession();
    session.handle({ type: "setSpeed", stepsPerSecond: 10 });
    session.handle({ type: "play" });
    // 1.5 steps are due: one runs, half a step is carried.
    expect(session.advance(150)).toMatchObject({ clock: 1 });
    expect(session.handle({ type: "load", seed: 1, source: CLOCK_NAND })).toMatchObject({
      clock: 0,
      running: true,
      outputs: [1],
    });
    // The carry was reset, so half a step is not enough.
    expect(session.advance(50)).toBeUndefined();
    // 10/s survived: 0.5 + 1 steps are due (at the default 4/s only 0.6 would be).
    expect(session.advance(100)).toMatchObject({ clock: 1, running: true, outputs: [0] });
  });

  test("controls and advance before a load are BadMessage / undefined", () => {
    const session = createEngineSession();
    for (const message of [
      { type: "play" },
      { type: "pause" },
      { type: "step" },
      { type: "setSpeed", stepsPerSecond: 10 },
    ]) {
      expect(session.handle(message)).toEqual({ type: "error", error: { type: "BadMessage" } });
    }
    expect(session.advance(1000)).toBeUndefined();
  });

  test("a failed reload stops advancing until the next good load", () => {
    const session = loadedClockSession();
    session.handle({ type: "play" });
    const bad = { ...CLOCK_NAND, outputs: [{ kind: "nand", index: 5 }] };
    expect(session.handle({ type: "load", seed: 1, source: bad })).toMatchObject({ type: "error" });
    expect(session.advance(1000)).toBeUndefined();
    expect(session.handle({ type: "step" })).toEqual({
      type: "error",
      error: { type: "BadMessage" },
    });
  });
});

/**
 * A NAND latch gated by the clock. A low clock holds both outputs at 1; each rising edge starts
 * a symmetric race that only the seeded holds can break.
 */
const CLOCKED_LATCH = {
  inputCount: 0,
  nands: [
    { a: { kind: "clock" }, b: { kind: "nand", index: 1 } },
    { a: { kind: "clock" }, b: { kind: "nand", index: 0 } },
  ],
  outputs: [
    { kind: "nand", index: 0 },
    { kind: "nand", index: 1 },
  ],
};

const loadLatch = (seed: number) => {
  const session = createEngineSession();
  session.handle({ type: "load", seed, source: CLOCKED_LATCH });
  return session;
};

const playingLatch = () => {
  const session = loadLatch(7);
  session.handle({ type: "setSpeed", stepsPerSecond: 10 });
  session.handle({ type: "play" });
  return session;
};

/** Calls `run` `times` times and returns the last result. */
const repeat = <T>(times: number, run: () => T): T | undefined =>
  Array.from({ length: times }, run).at(-1);

const stripRunning = (reply: unknown): unknown => {
  if (typeof reply !== "object" || reply === null || !("running" in reply)) {
    return reply;
  }
  const { running: _running, ...rest } = reply;
  return rest;
};

describe("clock determinism", () => {
  test("same seed and step count give the same state regardless of batching", () => {
    const oneBatch = playingLatch().advance(900);
    const manyBatches = playingLatch();
    const batched = repeat(9, () => manyBatches.advance(100));
    const stepping = loadLatch(7);
    const stepped = repeat(9, () => stepping.handle({ type: "step" }));

    expect(oneBatch).toMatchObject({ type: "state", clock: 1, stable: true });
    expect(stripRunning(oneBatch)).toEqual(stripRunning(batched));
    expect(stripRunning(batched)).toEqual(stripRunning(stepped));
  });

  test("across seeds 1..20 the clocked race has both winners", () => {
    const winners = new Set(
      Array.from({ length: 20 }, (_unused, offset) => {
        const reply = loadLatch(offset + 1).handle({ type: "step" });
        return reply.type === "state" ? reply.outputs.join("") : "error";
      }),
    );
    expect(winners).toEqual(new Set(["01", "10"]));
  });
});
