/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { newInstanceId, WireIdSchema } from "~/shared/ids";

import { initialInteraction } from "./interaction";
import type { InteractionState } from "./interaction";
import { addInstances, selectInstances, selectWire } from "./selection";
import { barChipActions, barVisible, offersSelectOnAll } from "./selection-bar";

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

const withPins = (): InteractionState => ({
  ...initialInteraction(CAMERA, "select"),
  selection: { ...selectInstances([]), pins: [PIN] },
});
const OTHER = newInstanceId();
const twoSelected = (): InteractionState => ({
  ...initialInteraction(CAMERA, "select"),
  selection: addInstances(selectInstances([ID]), [OTHER]),
});
const card = (pinned: boolean, instanceId = ID) => ({
  instanceId,
  pin: 0,
  screen: POINT,
  pinned,
});

describe("barVisible with pins", () => {
  it("shows for selected pins alone", () => {
    expect(barVisible(withPins())).toBe(true);
  });

  it("hides while armed", () => {
    expect(barVisible({ ...withPins(), armed: { end: PIN, legal: new Set() } })).toBe(false);
  });
});

describe("barChipActions", () => {
  it("is true with chips selected", () => {
    expect(barChipActions(selected())).toBe(true);
  });

  it("is false with only pins selected", () => {
    expect(barChipActions(withPins())).toBe(false);
  });
});

describe("offersSelectOnAll", () => {
  it("is true for a pinned card on a selected chip among several", () => {
    expect(offersSelectOnAll({ ...twoSelected(), card: card(true) })).toBe(true);
  });

  it("is false without a card", () => {
    expect(offersSelectOnAll(twoSelected())).toBe(false);
  });

  it("is false for a hover card", () => {
    expect(offersSelectOnAll({ ...twoSelected(), card: card(false) })).toBe(false);
  });

  it("is false with a single chip selected", () => {
    expect(offersSelectOnAll({ ...selected(), card: card(true) })).toBe(false);
  });

  it("is false when the card's chip is not selected", () => {
    const stranger = card(true, newInstanceId());
    expect(offersSelectOnAll({ ...twoSelected(), card: stranger })).toBe(false);
  });
});
