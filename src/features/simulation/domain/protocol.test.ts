import { describe, expect, test } from "vitest";

import { FromEngineSchema, ToEngineSchema } from "./protocol";

describe("ToEngineSchema", () => {
  test.each([
    {
      type: "load",
      seed: 42,
      source: {
        inputCount: 1,
        nands: [{ a: { kind: "input", index: 0 }, b: { kind: "nand", index: 0 } }],
        outputs: [{ kind: "nand", index: 0 }],
      },
    },
    { type: "setInput", index: 0, value: 1 },
    {
      type: "load",
      seed: 7,
      source: {
        inputCount: 0,
        nands: [{ a: { kind: "clock" }, b: { kind: "clock" } }],
        outputs: [{ kind: "clock" }],
      },
    },
    { type: "settle", maxTicks: 100 },
    { type: "play" },
    { type: "pause" },
    { type: "step" },
    { type: "setSpeed", stepsPerSecond: 0.5 },
    { type: "setSpeed", stepsPerSecond: 1000 },
  ] as const)("accepts %o", (message: unknown) => {
    expect(ToEngineSchema.safeParse(message).success).toBe(true);
  });
});

describe("ToEngineSchema rejects", () => {
  test.each([
    { type: "setInput", index: -1, value: 2 },
    { type: "setInput", index: 0.5, value: 0 },
    { type: "settle", maxTicks: 0 },
    { type: "load", seed: 1, source: { inputCount: -1, nands: [], outputs: [] } },
    {
      type: "load",
      seed: 1,
      source: { inputCount: 0, nands: [], outputs: [{ kind: "wire", index: 0 }] },
    },
    { type: "explode" },
    { type: "setSpeed", stepsPerSecond: 0.4 },
    { type: "setSpeed", stepsPerSecond: 1001 },
    { type: "setSpeed", stepsPerSecond: Number.NaN },
    "load",
    undefined,
  ] as const)("rejects %o", (message: unknown) => {
    expect(ToEngineSchema.safeParse(message).success).toBe(false);
  });
});

describe("FromEngineSchema", () => {
  test.each([
    { type: "state", tick: 3, stable: true, outputs: [0, 1], clock: 1, running: true },
    { type: "error", error: { type: "BadMessage" } },
    { type: "error", error: { type: "SignalOutOfRange", ref: { kind: "nand", index: 5 } } },
  ] as const)("accepts %o", (message: unknown) => {
    expect(FromEngineSchema.safeParse(message).success).toBe(true);
  });

  test.each([
    { type: "state", tick: 3, stable: true, outputs: [2], clock: 0, running: false },
    { type: "state", tick: 3, stable: true, outputs: [0], clock: 2, running: false },
    { type: "error", error: { type: "Nope" } },
  ] as const)("rejects %o", (message: unknown) => {
    expect(FromEngineSchema.safeParse(message).success).toBe(false);
  });
});

test("a state reply needs clock and running", () => {
  const base = { type: "state", tick: 0, stable: true, outputs: [] };
  expect(FromEngineSchema.safeParse(base).success).toBe(false);
  expect(FromEngineSchema.safeParse({ ...base, clock: 0 }).success).toBe(false);
  expect(FromEngineSchema.safeParse({ ...base, running: false }).success).toBe(false);
  expect(FromEngineSchema.safeParse({ ...base, clock: 0, running: false }).success).toBe(true);
});
