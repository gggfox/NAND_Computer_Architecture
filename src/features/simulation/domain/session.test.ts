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
