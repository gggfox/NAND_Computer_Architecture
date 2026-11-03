/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { WIRE_COLORS } from "~/features/projects";
import { themes } from "~/features/theming";
import { contrastRatio } from "~/shared/contrast";

import { GHOST_ALPHA, drawGhosts } from "./draw-ghosts";
import type { GhostsView } from "./draw-ghosts";
import type { Frame } from "./frame";

const noop = (): void => {};
const palette = { wire: "#wire", "wire-teal": "#teal", "focus-ring": "#ring" };
const visible = { x: 0, y: 0, width: 100, height: 100 };
const on = {
  route: [
    { x: 10, y: 10 },
    { x: 50, y: 10 },
  ],
  focused: false,
};
const off = {
  route: [
    { x: 500, y: 500 },
    { x: 600, y: 500 },
  ],
  focused: false,
};

interface Stroke {
  readonly style: string;
  readonly alpha: number;
  readonly dash: readonly number[];
  readonly width: number;
}

/** A context that records each stroke with the state it was made in. */
const draw = (view: GhostsView, zoom = 1) => {
  const strokes: Stroke[] = [];
  const ctx = {
    strokeStyle: "",
    lineWidth: 0,
    globalAlpha: 1,
    lineJoin: "",
    dash: [] as readonly number[],
    setLineDash(dash: readonly number[]) {
      this.dash = dash;
    },
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke() {
      strokes.push({
        style: this.strokeStyle,
        alpha: this.globalAlpha,
        dash: this.dash,
        width: this.lineWidth,
      });
    },
  };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a recording stand-in for the canvas
  const frame = { ctx, palette, zoom, visible } as unknown as Frame;
  drawGhosts(frame, view);
  return { strokes, ctx };
};

describe("drawGhosts", () => {
  it("strokes each visible ghost dashed and translucent, at the wire width", () => {
    const { strokes } = draw({ ghosts: [on, on] });
    expect(strokes).toEqual([
      { style: "#wire", alpha: GHOST_ALPHA, dash: [6, 6], width: 3 },
      { style: "#wire", alpha: GHOST_ALPHA, dash: [6, 6], width: 3 },
    ]);
  });

  it("scales the dash with the zoom", () => {
    expect(draw({ ghosts: [on] }, 2).strokes[0]?.dash).toEqual([3, 3]);
  });

  it("uses the colour a new wire would get", () => {
    expect(draw({ ghosts: [on], ghostColor: "teal" }).strokes[0]?.style).toBe("#teal");
  });

  it("puts a solid focus-ring halo under the focused ghost only", () => {
    const { strokes } = draw({ ghosts: [{ ...on, focused: true }, on] });
    expect(strokes.map((stroke) => stroke.style)).toEqual(["#ring", "#wire", "#wire"]);
    expect(strokes[0]).toMatchObject({ alpha: 1, dash: [], width: 9 });
  });

  it("skips ghosts wholly off screen", () => {
    expect(draw({ ghosts: [off, on] }).strokes).toHaveLength(1);
    expect(draw({ ghosts: [off] }).strokes).toHaveLength(0);
  });

  it("draws nothing for no ghosts, and resets the dash and alpha after", () => {
    expect(draw({}).strokes).toEqual([]);
    const { ctx } = draw({ ghosts: [{ ...on, focused: true }] });
    expect(ctx.dash).toEqual([]);
    expect(ctx.globalAlpha).toBe(1);
  });
});

const MIN_UI = 3;
const STEP = 0.05;
const HEX_RADIX = 16;
const channels = (hex: string): number[] =>
  [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), HEX_RADIX));

/** `ink` blended over `canvas` at `alpha`, as the canvas composites it (in sRGB). */
const blend = (ink: string, canvas: string, alpha: number): string => {
  const back = channels(canvas);
  const mixed = channels(ink).map((value, index) => {
    const behind = back[index] ?? 0;
    return Math.round(alpha * value + (1 - alpha) * behind);
  });
  return `#${mixed.map((value) => value.toString(HEX_RADIX).padStart(2, "0")).join("")}`;
};

const WIRE_KEYS = {
  blue: "colorWireBlue",
  red: "colorWireRed",
  orange: "colorWireOrange",
  yellow: "colorWireYellow",
  green: "colorWireGreen",
  teal: "colorWireTeal",
  purple: "colorWirePurple",
  pink: "colorWirePink",
} as const satisfies Record<(typeof WIRE_COLORS)[number], keyof (typeof themes)["light"]>;

const COLORS = ["default", ...WIRE_COLORS] as const;
const cases = Object.entries(themes).flatMap(([id, tokens]) =>
  COLORS.map((color) => ({
    id,
    color,
    ink: color === "default" ? tokens.colorWire : tokens[WIRE_KEYS[color]],
    canvas: tokens.colorBackground,
  })),
);

const holds = (alpha: number): boolean =>
  cases.every(({ ink, canvas }) => contrastRatio(blend(ink, canvas, alpha), canvas) >= MIN_UI);

describe("GHOST_ALPHA (D17)", () => {
  it.each(cases)("$id, $color: the blended stroke has 3:1 on the canvas", ({ ink, canvas }) => {
    expect(contrastRatio(blend(ink, canvas, GHOST_ALPHA), canvas)).toBeGreaterThanOrEqual(MIN_UI);
  });

  it("is the lowest step that holds in every case", () => {
    expect(holds(GHOST_ALPHA)).toBe(true);
    expect(holds(Math.round((GHOST_ALPHA - STEP) / STEP) * STEP)).toBe(false);
  });
});
