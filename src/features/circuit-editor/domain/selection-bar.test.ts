/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { newInstanceId, WireIdSchema } from "~/shared/ids";

import { SCREEN_PAD } from "./camera";
import { initialInteraction } from "./interaction";
import type { InteractionState } from "./interaction";
import { selectInstances, selectWire } from "./selection";
import { BAR_GAP, BAR_MIN_TOP, barPlacement, barVisible } from "./selection-bar";

const CAMERA = { zoom: 1, x: 0, y: 0 };
const ID = newInstanceId();
const POINT = { x: 0, y: 0 };
const PIN = { instanceId: ID, pin: 0 };
const selected = (): InteractionState => ({
  ...initialInteraction(CAMERA, "select"),
  selection: selectInstances([ID]),
});

describe("barVisible", () => {
  it("shows for a selected chip", () => {
    expect(barVisible(selected())).toBe(true);
  });

  it("hides with nothing selected", () => {
    expect(barVisible(initialInteraction(CAMERA, "select"))).toBe(false);
  });

  it("hides when only wires are selected", () => {
    const wire = WireIdSchema.parse("00000000-0000-4000-8000-0000000000aa");
    const state = { ...initialInteraction(CAMERA, "select"), selection: selectWire(wire) };
    expect(barVisible(state)).toBe(false);
  });

  const blockers: readonly (readonly [string, Partial<InteractionState>])[] = [
    ["drag", { drag: { kind: "pan", last: POINT } }],
    ["armed", { armed: { end: PIN, legal: new Set() } }],
    ["placing", { placing: { type: "nand" } }],
    ["menu", { menu: { kind: "canvas", screen: POINT } }],
    ["renaming", { renaming: { instanceId: ID, screen: POINT } }],
    ["arraying", { arraying: true }],
    ["bitPick", { bitPick: { armed: PIN, target: PIN, bus: "armed", bits: [0], screen: POINT } }],
  ];
  it.each(blockers)("hides while %s is set", (_name, patch) => {
    expect(barVisible({ ...selected(), ...patch })).toBe(false);
  });
});

describe("barPlacement", () => {
  const bounds = { x: 100, y: 200, width: 80, height: 40 };

  it("sits above the centre-top", () => {
    expect(barPlacement(bounds, CAMERA)).toEqual({
      point: { x: SCREEN_PAD + 140, y: SCREEN_PAD + 200 - BAR_GAP },
      side: "above",
    });
  });

  it("flips below near the top of the canvas", () => {
    const top = { ...bounds, y: 0 };
    expect(SCREEN_PAD - BAR_GAP).toBeLessThan(BAR_MIN_TOP);
    expect(barPlacement(top, CAMERA)).toEqual({
      point: { x: SCREEN_PAD + 140, y: SCREEN_PAD + 40 + BAR_GAP },
      side: "below",
    });
  });

  it("follows zoom and pan", () => {
    const camera = { zoom: 2, x: 50, y: 100 };
    expect(barPlacement(bounds, camera)).toEqual({
      point: { x: SCREEN_PAD + (140 - 50) * 2, y: SCREEN_PAD + (200 - 100) * 2 - BAR_GAP },
      side: "above",
    });
  });
});
