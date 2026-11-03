/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { ARRAY_LIMITS, arrayDeltas, arraySummary, defaultColumns } from "./array";
import type { ArrayRequest } from "./array";

const request = (over: Partial<ArrayRequest>): ArrayRequest => ({
  count: 3,
  direction: "row",
  columns: 4,
  spacing: 1,
  ...over,
});
const BOX = { width: 80, height: 80 };

describe("arrayDeltas", () => {
  it("lays a row out to the right, one step apart", () => {
    expect(arrayDeltas(request({}), BOX)).toEqual([
      { x: 120, y: 0 },
      { x: 240, y: 0 },
      { x: 360, y: 0 },
    ]);
  });

  it("lays a column out downwards", () => {
    expect(arrayDeltas(request({ direction: "column" }), BOX)).toEqual([
      { x: 0, y: 120 },
      { x: 0, y: 240 },
      { x: 0, y: 360 },
    ]);
  });

  it("rounds bounds up to whole grid steps before adding the gap", () => {
    const deltas = arrayDeltas(request({ count: 1 }), { width: 90, height: 50 });
    expect(deltas).toEqual([{ x: 160, y: 0 }]);
    const down = arrayDeltas(request({ count: 1, direction: "column" }), { width: 90, height: 50 });
    expect(down).toEqual([{ x: 0, y: 120 }]);
  });

  it("lets copies touch without overlapping at spacing 0", () => {
    expect(arrayDeltas(request({ spacing: 0, count: 2 }), BOX)).toEqual([
      { x: 80, y: 0 },
      { x: 160, y: 0 },
    ]);
  });

  it("fills a grid row by row, the originals being cell 0", () => {
    const deltas = arrayDeltas(request({ count: 15, direction: "grid" }), BOX);
    expect(deltas).toHaveLength(15);
    expect(deltas[0]).toEqual({ x: 120, y: 0 });
    expect(deltas[3]).toEqual({ x: 0, y: 120 });
    expect(new Set(deltas.map(({ x, y }) => `${x},${y}`)).size).toBe(15);
  });

  it("treats a one-column grid as a column", () => {
    const grid = arrayDeltas(request({ direction: "grid", columns: 1 }), BOX);
    expect(grid).toEqual(arrayDeltas(request({ direction: "column" }), BOX));
  });
});

describe("arrayDeltas clamping", () => {
  it("clamps out-of-range values instead of refusing them", () => {
    expect(arrayDeltas(request({ count: 500 }), BOX)).toHaveLength(ARRAY_LIMITS.count.max);
    expect(arrayDeltas(request({ count: 0 }), BOX)).toHaveLength(ARRAY_LIMITS.count.min);
    expect(arrayDeltas(request({ count: 1, spacing: -3 }), BOX)).toEqual([{ x: 80, y: 0 }]);
    expect(arrayDeltas(request({ count: 1, spacing: 99 }), BOX)).toEqual([{ x: 400, y: 0 }]);
    const wide = arrayDeltas(request({ count: 20, direction: "grid", columns: 99 }), BOX);
    expect(wide[15]).toEqual({ x: 0, y: 120 });
  });
});

describe("arraySummary", () => {
  it("counts the originals in a row", () => {
    expect(arraySummary(request({}))).toEqual({ columns: 4, rows: 1, chips: 4 });
  });

  it("counts the originals in a column", () => {
    expect(arraySummary(request({ direction: "column" }))).toEqual({
      columns: 1,
      rows: 4,
      chips: 4,
    });
  });

  it("fills a square grid", () => {
    const summary = arraySummary(request({ count: 15, direction: "grid" }));
    expect(summary).toEqual({ columns: 4, rows: 4, chips: 16 });
  });

  it("rounds rows up when the last row is partial", () => {
    const summary = arraySummary(request({ count: 4, direction: "grid" }));
    expect(summary).toEqual({ columns: 4, rows: 2, chips: 5 });
  });

  it("shrinks columns to the chips there are", () => {
    const summary = arraySummary(request({ count: 1, direction: "grid" }));
    expect(summary).toEqual({ columns: 2, rows: 1, chips: 2 });
  });
});

describe("defaultColumns", () => {
  it("is the ceiling of the square root of count + 1", () => {
    expect(defaultColumns(15)).toBe(4);
    expect(defaultColumns(1)).toBe(2);
    expect(defaultColumns(64)).toBe(9);
  });

  it("stays within the column limits", () => {
    expect(defaultColumns(0)).toBe(ARRAY_LIMITS.columns.min);
    expect(defaultColumns(1000)).toBe(ARRAY_LIMITS.columns.max);
  });
});
