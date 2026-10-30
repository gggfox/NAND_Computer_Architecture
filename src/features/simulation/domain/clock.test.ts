import { describe, expect, test } from "vitest";

import {
  CLOCK_BATCH_MS,
  DEFAULT_STEPS_PER_SECOND,
  MAX_STEPS_PER_BATCH,
  MAX_STEPS_PER_SECOND,
  MIN_STEPS_PER_SECOND,
  stepsDue,
} from "./clock";

describe("clock constants", () => {
  test("speed range, default and batching match the plan", () => {
    expect([MIN_STEPS_PER_SECOND, DEFAULT_STEPS_PER_SECOND, MAX_STEPS_PER_SECOND]).toEqual([
      0.5, 4, 1000,
    ]);
    expect([CLOCK_BATCH_MS, MAX_STEPS_PER_BATCH]).toEqual([16, 64]);
  });
});

describe("stepsDue", () => {
  test("1 s at 10/s is 10 steps", () => {
    expect(stepsDue(0, 1000, 10)).toEqual({ steps: 10, carrySteps: 0 });
  });

  test("fractions carry over", () => {
    expect(stepsDue(0, 150, 10)).toEqual({ steps: 1, carrySteps: 0.5 });
    expect(stepsDue(0.5, 50, 10)).toEqual({ steps: 1, carrySteps: 0 });
  });

  test("a batch is capped at 64 and the excess dropped", () => {
    expect(stepsDue(0, 1000, 1000)).toEqual({ steps: 64, carrySteps: 0 });
  });

  test("negative or NaN elapsed adds nothing", () => {
    expect(stepsDue(0.5, -5, 10)).toEqual({ steps: 0, carrySteps: 0.5 });
    expect(stepsDue(0.5, Number.NaN, 10)).toEqual({ steps: 0, carrySteps: 0.5 });
    expect(stepsDue(0.5, Number.POSITIVE_INFINITY, 10)).toEqual({ steps: 0, carrySteps: 0.5 });
  });
});
