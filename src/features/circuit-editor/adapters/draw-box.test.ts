/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { toCornerStyle, traceBox } from "./draw-box";
import type { BoxShape } from "./draw-box";

const RECT = { x: 10, y: 20, width: 40, height: 30 };

/** A context that records the path the drawing traces. */
const trace = (shape: BoxShape) => {
  const calls: string[] = [];
  const ctx = {
    moveTo: (x: number, y: number) => calls.push(`M${String(x)},${String(y)}`),
    lineTo: (x: number, y: number) => calls.push(`L${String(x)},${String(y)}`),
    closePath: () => calls.push("Z"),
    roundRect: (...values: readonly number[]) => calls.push(`R${values.join(",")}`),
  };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a recording stand-in for the canvas
  traceBox(ctx as unknown as CanvasRenderingContext2D, RECT, shape);
  return calls;
};

describe("traceBox", () => {
  it("draws a rounded rectangle in the round style", () => {
    expect(trace({ corners: "round", radius: 4, bevel: 8 })).toEqual(["R10,20,40,30,4"]);
  });

  it("cuts each corner at 45 degrees in the bevel style", () => {
    expect(trace({ corners: "bevel", radius: 4, bevel: 8 })).toEqual([
      "M18,20",
      "L42,20",
      "L50,28",
      "L50,42",
      "L42,50",
      "L18,50",
      "L10,42",
      "L10,28",
      "Z",
    ]);
  });

  it("never cuts past the middle of a side", () => {
    expect(trace({ corners: "bevel", radius: 4, bevel: 100 })[0]).toBe("M25,20");
  });
});

describe("toCornerStyle", () => {
  it("reads bevel, with spaces around it", () => {
    expect(toCornerStyle(" bevel")).toBe("bevel");
  });

  it("falls back to round for any other value", () => {
    expect(toCornerStyle("round")).toBe("round");
    expect(toCornerStyle("")).toBe("round");
  });
});
