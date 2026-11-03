import { assert, describe, expect, it } from "vitest";

import {
  PINS,
  SHIFT,
  allSelected,
  cardOn,
  grid,
  pinOf,
  where,
} from "./interaction-pin-select.fixtures";
import { command, gesture, screen, tap } from "./interaction.fixtures";
import { selectInstances } from "./selection";

const count = (pins: number) => ({
  type: "announce",
  announcement: { type: "pinsSelected", count: pins },
});

describe("Shift+tap on a pin", () => {
  it("adds it, and a second one removes it, each announcing the count", () => {
    const { context, state, chips } = grid();
    const [first] = chips;
    assert(first !== undefined);
    const added = gesture(state, context, tap(where(first), "mouse", SHIFT));
    expect(added.state.selection.pins).toEqual([pinOf(first)]);
    expect(added.effects).toEqual([count(1)]);
    const removed = gesture(added.state, context, tap(where(first), "mouse", SHIFT));
    expect(removed.state.selection.pins).toEqual([]);
    expect(removed.effects).toEqual([count(0)]);
  });

  it("disarms an armed pin and adds the tapped one", () => {
    const { context, state, chips } = grid();
    const [first, second] = chips;
    assert(first !== undefined && second !== undefined);
    const armed = gesture(state, context, tap(where(first))).state;
    expect(armed.armed).toBeDefined();
    const result = gesture(armed, context, tap(where(second), "mouse", SHIFT));
    expect(result.state.armed).toBeUndefined();
    expect(result.state.selection.pins).toEqual([pinOf(second)]);
  });
});

describe("Pick pins", () => {
  it("a plain tap adds the pin and arms nothing", () => {
    const { context, state, chips } = grid();
    const [first] = chips;
    assert(first !== undefined);
    const picking = command(state, context, { type: "togglePinPick" }).state;
    expect(picking.pinPick).toBe(true);
    const result = gesture(picking, context, tap(where(first)));
    expect(result.state).toMatchObject({ pinPick: true, selection: { pins: [pinOf(first)] } });
    expect(result.state.armed).toBeUndefined();
    const off = command(result.state, context, { type: "togglePinPick" });
    expect(off.state.pinPick).toBeUndefined();
  });

  it("stays on while the chips change and goes off when the selection is cleared", () => {
    const { context, state, chips } = grid();
    const [first] = chips;
    assert(first !== undefined);
    const picking = { ...allSelected(state, chips), pinPick: true } as const;
    const body = tap(screen(first.position.x + 60, first.position.y + 40));
    expect(gesture(picking, context, body).state.pinPick).toBe(true);
    const cleared = gesture(picking, context, tap(screen(900, 900)));
    expect(cleared.state.pinPick).toBeUndefined();
  });
});

describe("togglePin", () => {
  it("does nothing without a card", () => {
    const { context, state } = grid();
    expect(command(state, context, { type: "togglePin" })).toEqual({ state, effects: [] });
  });

  it("toggles the card's pin and keeps the card", () => {
    const { context, state, chips } = grid();
    const [first] = chips;
    assert(first !== undefined);
    const card = cardOn(first);
    const on = command({ ...state, card }, context, { type: "togglePin" });
    expect(on.state.selection.pins).toEqual([pinOf(first)]);
    expect(on.state.card).toEqual(card);
    const off = command(on.state, context, { type: "togglePin" });
    expect(off.state.selection.pins).toEqual([]);
  });
});

describe("select this pin on all selected chips", () => {
  it("picks the card's pin on every selected chip in reading order", () => {
    const { context, state, chips, reading } = grid();
    const card = cardOn(chips[5]);
    const selected = { ...allSelected(state, chips), card };
    const result = command(selected, context, { type: "selectPinOnAll" });
    expect(result.state.selection.pins).toEqual(reading.map((chip) => pinOf(chip)));
    expect(result.state.selection.pins).toHaveLength(PINS);
    expect(result.effects).toEqual([count(PINS)]);
  });

  it("does nothing without a card", () => {
    const { context, state, chips } = grid();
    const many = allSelected(state, chips);
    expect(command(many, context, { type: "selectPinOnAll" }).state).toBe(many);
  });

  it("does nothing with one chip, or when the card's chip is not selected", () => {
    const { context, state, chips } = grid();
    const [first, second, third] = chips;
    assert(first !== undefined && second !== undefined && third !== undefined);
    const card = cardOn(first);
    const single = { ...state, selection: selectInstances([first.id]), card };
    expect(command(single, context, { type: "selectPinOnAll" }).state).toBe(single);
    const apart = { ...state, selection: selectInstances([second.id, third.id]), card };
    expect(command(apart, context, { type: "selectPinOnAll" }).state).toBe(apart);
  });
});
