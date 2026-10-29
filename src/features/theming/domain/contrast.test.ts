import { expect, test } from "vitest";

import { contrastRatio } from "./contrast";

const WHITE_ON_BLACK = 21;
const PRECISION = 1;

test("contrastRatio: black on white is 21", () => {
  expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(WHITE_ON_BLACK, PRECISION);
});

test("contrastRatio is symmetric and 1 for identical colors", () => {
  expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, PRECISION);
  expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(WHITE_ON_BLACK, PRECISION);
});

test("contrastRatio: uppercase hex and low-channel (<= 0.03928) values", () => {
  expect(contrastRatio("#0A0A0A", "#FFFFFF")).toBeGreaterThan(18);
});

test("contrastRatio: malformed hex yields NaN", () => {
  expect(contrastRatio("nope", "#ffffff")).toBeNaN();
});
