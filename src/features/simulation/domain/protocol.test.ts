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
    { type: "settle", maxTicks: 100 },
  ] as const)("accepts %o", (message) => {
    expect(ToEngineSchema.safeParse(message).success).toBe(true);
  });

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
    "load",
    undefined,
  ] as const)("rejects %o", (message) => {
    expect(ToEngineSchema.safeParse(message).success).toBe(false);
  });
});

describe("FromEngineSchema", () => {
  test.each([
    { type: "state", tick: 3, stable: true, outputs: [0, 1] },
    { type: "error", error: { type: "BadMessage" } },
    { type: "error", error: { type: "SignalOutOfRange", ref: { kind: "nand", index: 5 } } },
  ] as const)("accepts %o", (message) => {
    expect(FromEngineSchema.safeParse(message).success).toBe(true);
  });

  test.each([
    { type: "state", tick: 3, stable: true, outputs: [2] },
    { type: "error", error: { type: "Nope" } },
  ] as const)("rejects %o", (message) => {
    expect(FromEngineSchema.safeParse(message).success).toBe(false);
  });
});
