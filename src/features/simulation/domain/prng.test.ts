import { describe, expect, test } from "vitest";

import { createPrng } from "./prng";

const take = (next: () => number, count: number): number[] =>
  Array.from({ length: count }, () => next());

describe("createPrng", () => {
  test("same seed yields the same sequence", () => {
    expect(take(createPrng(42), 5)).toEqual(take(createPrng(42), 5));
  });
  test("different seeds yield different sequences", () => {
    expect(take(createPrng(1), 5)).not.toEqual(take(createPrng(2), 5));
  });
  test("values are floats in [0, 1)", () => {
    for (const value of take(createPrng(7), 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
