/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { drawPickedPins } from "./draw-picked-pins";
import type { PaintFrame, PickedView } from "./draw-picked-pins";

const noop = (): void => {};
const palette = { text: "#text", "focus-ring": "#ring", "wire-red": "#red" };

/** A context that records the calls the drawing makes. */
const draw = (view: PickedView, zoom: number) => {
  const arcs: { style: unknown }[] = [];
  const numbers: string[] = [];
  const ctx = {
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "",
    textBaseline: "",
    beginPath: noop,
    arc() {
      arcs.push({ style: this.strokeStyle });
    },
    stroke: noop,
    fillText: (text: string) => numbers.push(text),
  };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a recording stand-in for the canvas
  const frame = { ctx, palette, zoom } as unknown as PaintFrame;
  drawPickedPins(frame, view);
  return { arcs, numbers };
};

const picked = [
  { at: { x: 0, y: 0 }, order: 1 },
  { at: { x: 10, y: 0 }, order: 2 },
];

describe("drawPickedPins", () => {
  it("draws one ring per picked pin and its order number", () => {
    const { arcs, numbers } = draw({ picked }, 1);
    expect(arcs).toEqual([{ style: "#ring" }, { style: "#ring" }]);
    expect(numbers).toEqual(["1", "2"]);
  });

  it("hides the numbers when they would be under 10 px, but keeps the rings", () => {
    const { arcs, numbers } = draw({ picked }, 0.5);
    expect(arcs).toHaveLength(2);
    expect(numbers).toEqual([]);
  });

  it("draws the refused pin in the warning colour", () => {
    const { arcs, numbers } = draw({ refusedAt: { x: 3, y: 4 } }, 1);
    expect(arcs).toEqual([{ style: "#red" }]);
    expect(numbers).toEqual([]);
  });

  it("draws nothing for an empty view", () => {
    expect(draw({}, 1)).toEqual({ arcs: [], numbers: [] });
  });
});
