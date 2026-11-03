import { assert, describe, expect, it } from "vitest";

import { pinDef, pinPiece, wire } from "~/features/projects";

import { interact } from "./interact";
import { wireSelectedPins } from "./interaction-pin-select";
import {
  PINS,
  cardOn,
  contextOf,
  grid,
  picked,
  pinOf,
  where,
} from "./interaction-pin-select.fixtures";
import { PIN_A_OUT, dispatched } from "./interaction-wiring.fixtures";
import { command, drag, gesture, gestures, tap } from "./interaction.fixtures";
import { withPins } from "./selection";

const BUS_WIDTH = 4;
const SOME = 3;

/** The wires of the one `connectWires` among `effects`. */
const wiresOf = (effects: Parameters<typeof dispatched>[0]) =>
  dispatched(effects).flatMap((action) => (action.type === "connectWires" ? action.wires : []));

describe("a plain tap on the source", () => {
  it("dispatches one connectWires in the wire colour", () => {
    const rig = grid();
    const { context, pieceA } = rig;
    const colored = command(picked(rig), context, { type: "setWireColor", color: "red" });
    const result = gesture(colored.state, context, tap(PIN_A_OUT));
    expect(dispatched(result.effects)).toEqual([
      expect.objectContaining({ type: "connectWires", chipId: context.chipId, color: "red" }),
    ]);
    const wires = wiresOf(result.effects);
    expect(new Set(wires.map((item) => item.wireId)).size).toBe(PINS);
    expect(wires.every((item) => item.from.instanceId === pieceA.id)).toBe(true);
  });

  it("clears the pins, keeps the chips and announces the count", () => {
    const rig = grid();
    const { context, pieceA, chips } = rig;
    const result = gesture(picked(rig), context, tap(PIN_A_OUT));
    expect(result.state.selection.pins).toEqual([]);
    expect(result.state.selection.instances.size).toBe(chips.length);
    expect(result.effects.at(-1)).toEqual({
      type: "announce",
      announcement: { type: "bulkWired", count: PINS, source: pinOf(pieceA) },
    });
  });
});

describe("a tap on a bus, or on a selected pin", () => {
  it("announces the bits when a bus is wired bit by bit", () => {
    const { context, state, chips, circuit } = grid();
    const bus = pinDef("D", "input", BUS_WIDTH);
    const source = pinPiece(bus);
    const wide = {
      ...circuit,
      pins: [...circuit.pins, bus],
      instances: [...circuit.instances, source],
    };
    const pins = chips.slice(0, SOME).map((chip) => pinOf(chip));
    const selection = withPins(state.selection, pins);
    const result = wireSelectedPins(
      { ...state, selection },
      pinOf(source),
      contextOf(context, wide),
    );
    expect(dispatched(result.effects)).toHaveLength(1);
    expect(result.effects.at(-1)).toEqual({
      type: "announce",
      announcement: {
        type: "bulkWired",
        count: SOME,
        source: pinOf(source),
        bits: { first: 0, last: SOME - 1 },
      },
    });
  });

  it("is refused on a pin in the list", () => {
    const rig = grid();
    const [first] = rig.chips;
    assert(first !== undefined);
    const result = gesture(picked(rig), rig.context, tap(where(first)));
    expect(dispatched(result.effects)).toEqual([]);
    expect(result.state.notice).toMatchObject({ reason: { type: "SourceSelected" } });
  });
});

describe("a refused bulk wire", () => {
  it("dispatches nothing, sets the notice, announces it and keeps the pins", () => {
    const rig = grid();
    const { context, pieceA, chips, circuit } = rig;
    const driven = chips.at(SOME);
    const before = picked(rig);
    const driving = { ...circuit, wires: driven ? [wire(pinOf(pieceA), pinOf(driven))] : [] };
    const result = gesture(before, contextOf(context, driving), tap(PIN_A_OUT));
    const refusal = result.state.notice;
    expect(refusal).toMatchObject({ reason: { type: "InputAlreadyDriven" } });
    expect(result.state.selection.pins).toEqual(before.selection.pins);
    expect(result.effects).toEqual([
      { type: "announce", announcement: { type: "bulkRefused", refusal } },
    ]);
  });

  it("wiring no pins dispatches nothing", () => {
    const { context, state, pieceA } = grid();
    expect(wireSelectedPins(state, pinOf(pieceA), context)).toEqual({ state, effects: [] });
  });
});

describe("Enter", () => {
  it("wires the pins to the card's pin and turns Pick pins off", () => {
    const rig = grid();
    const { context, pieceA } = rig;
    const card = { instanceId: pieceA.id, pin: 0, screen: PIN_A_OUT, pinned: true };
    const picking = { ...picked(rig), card, pinPick: true } as const;
    const result = command(picking, context, { type: "connect" });
    expect(dispatched(result.effects)).toEqual([expect.objectContaining({ type: "connectWires" })]);
    expect(result.state.pinPick).toBeUndefined();
  });

  it("does nothing with no pins selected or no card", () => {
    const rig = grid();
    const { context, state, pieceA } = rig;
    const card = { instanceId: pieceA.id, pin: 0, screen: PIN_A_OUT, pinned: true };
    expect(command({ ...state, card }, context, { type: "connect" }).effects).toEqual([]);
    expect(command(picked(rig), context, { type: "connect" }).effects).toEqual([]);
  });
});

describe("Escape", () => {
  it("clears the pins and Pick pins first, then the card, then the chips", () => {
    const rig = grid();
    const { context, chips } = rig;
    const card = cardOn(chips[0]);
    const escape = { type: "escape" } as const;
    const first = command({ ...picked(rig), card, pinPick: true }, context, escape);
    expect(first.state).toMatchObject({ card, selection: { pins: [] } });
    expect(first.state.pinPick).toBeUndefined();
    const second = command(first.state, context, escape);
    expect(second.state.card).toBeUndefined();
    expect(second.state.selection.instances.size).toBe(chips.length);
  });

  it("turns off Pick pins alone", () => {
    const { context, state } = grid();
    const picking = command(state, context, { type: "togglePinPick" }).state;
    const result = command(picking, context, { type: "escape" });
    expect(result.state.pinPick).toBeUndefined();
  });

  it("disarms an armed pin before it clears the list", () => {
    const { context, state, chips } = grid();
    const [first] = chips;
    assert(first !== undefined);
    const armed = gesture(state, context, tap(where(first))).state;
    const both = { ...armed, selection: withPins(armed.selection, [pinOf(first)]) };
    const once = command(both, context, { type: "escape" }).state;
    expect(once.armed).toBeUndefined();
    expect(once.selection.pins).toHaveLength(1);
  });
});

describe("unchanged behaviour", () => {
  it("a plain tap on a pin with no pins selected still arms it", () => {
    const { context, state, chips } = grid();
    const [first] = chips;
    assert(first !== undefined);
    const result = gesture(state, context, tap(where(first)));
    expect(result.state.armed?.end).toEqual(pinOf(first));
  });

  it("a wire drag with pins selected draws one wire and leaves the pins alone", () => {
    const rig = grid();
    const [first] = rig.chips;
    assert(first !== undefined);
    const before = picked(rig);
    const result = gestures(before, rig.context, drag(PIN_A_OUT, where(first)));
    expect(dispatched(result.effects)).toEqual([expect.objectContaining({ type: "connectWire" })]);
    expect(result.state.selection.pins).toEqual(before.selection.pins);
  });

  it("historyChanged prunes the pins of deleted chips", () => {
    const rig = grid();
    const { context, circuit } = rig;
    const [first] = rig.chips;
    assert(first !== undefined);
    const instances = circuit.instances.filter((item) => item.id !== first.id);
    const gone = contextOf(context, { ...circuit, instances });
    const result = interact(picked(rig), { type: "historyChanged" }, gone);
    expect(result.state.selection.pins).toHaveLength(PINS - 1);
    const left = result.state.selection.pins.map((pin) => pin.instanceId);
    expect(left).not.toContain(first.id);
  });
});
