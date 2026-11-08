/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import type { PinRef } from "~/features/projects";
import { InstanceIdSchema, WireIdSchema } from "~/shared/ids";

import type { InteractionState } from "./interaction";
import { wiring, dispatched } from "./interaction-wiring.fixtures";
import { command } from "./interaction.fixtures";

const MISSING_INSTANCE = InstanceIdSchema.parse("00000000-0000-4000-8000-0000000000ee");
const MISSING_WIRE = WireIdSchema.parse("00000000-0000-4000-8000-0000000000ef");

/** The demo without its A → a wire, so A's output can reach the NAND's free input `a`. */
const rig = () => {
  const base = wiring();
  const aOut: PinRef = { instanceId: base.pieceA.id, pin: 0 };
  const nandA: PinRef = { instanceId: base.nand.id, pin: 0 };
  return { ...base, aOut, nandA };
};

const withOverlays = (state: InteractionState, instanceId: PinRef["instanceId"]) => ({
  ...state,
  menu: { kind: "canvas", screen: { x: 1, y: 1 } } as const,
  card: { instanceId, pin: 0, screen: { x: 1, y: 1 }, pinned: true },
});

describe("selectItems", () => {
  it("selects a part and a wire, and announces both", () => {
    const { state, context, pieceA, circuit } = rig();
    const [wireId] = circuit.wires.map((item) => item.id);
    assert(wireId !== undefined);
    const result = command(state, context, {
      type: "selectItems",
      instanceIds: [pieceA.id],
      wireIds: [wireId],
    });
    expect([...result.state.selection.instances]).toEqual([pieceA.id]);
    expect([...result.state.selection.wires]).toEqual([wireId]);
    expect(result.state.focus).toBe(pieceA.id);
    expect(result.effects).toEqual([
      {
        type: "announce",
        announcement: { type: "selected", instanceIds: [pieceA.id], wires: 1 },
      },
    ]);
  });

  it("replaces the old selection and drops ids that do not exist", () => {
    const { state, context, pieceA, pieceB } = rig();
    const first = command(state, context, {
      type: "selectItems",
      instanceIds: [pieceA.id],
      wireIds: [],
    });
    const result = command(first.state, context, {
      type: "selectItems",
      instanceIds: [MISSING_INSTANCE, pieceB.id],
      wireIds: [MISSING_WIRE],
    });
    expect([...result.state.selection.instances]).toEqual([pieceB.id]);
    expect(result.state.selection.wires.size).toBe(0);
  });
});

describe("selectItems clearing and overlays", () => {
  it("clears the selection for empty lists", () => {
    const { state, context, pieceA } = rig();
    const first = command(state, context, {
      type: "selectItems",
      instanceIds: [pieceA.id],
      wireIds: [],
    });
    const result = command(first.state, context, {
      type: "selectItems",
      instanceIds: [],
      wireIds: [],
    });
    expect(result.state.selection.instances.size).toBe(0);
    expect(result.effects).toEqual([{ type: "announce", announcement: { type: "cleared" } }]);
  });

  it("closes the menu and the pin card, and never edits", () => {
    const { state, context, pieceA } = rig();
    const result = command(withOverlays(state, pieceA.id), context, {
      type: "selectItems",
      instanceIds: [pieceA.id],
      wireIds: [],
    });
    expect(result.state.menu).toBeUndefined();
    expect(result.state.card).toBeUndefined();
    expect(dispatched(result.effects)).toEqual([]);
  });
});

describe("connectPins", () => {
  it("emits one connectWire for a legal pair", () => {
    const { state, context, aOut, nandA } = rig();
    const result = command(state, context, { type: "connectPins", from: aOut, to: nandA });
    expect(dispatched(result.effects)).toEqual([
      {
        type: "connectWire",
        chipId: context.chipId,
        wireId: context.newWireId(),
        from: aOut,
        to: nandA,
      },
    ]);
    expect(result.effects.at(-1)).toEqual({
      type: "announce",
      announcement: { type: "wired", from: aOut, to: nandA },
    });
  });
});

describe("readOutputs", () => {
  it("announces every reading once and changes nothing else", () => {
    const { state, context } = rig();
    const readings = [
      { name: "SUM", value: 1 },
      { name: "CARRY", value: undefined },
    ];
    const result = command(state, context, { type: "readOutputs", readings });
    expect(result.state).toBe(state);
    expect(result.effects).toEqual([
      { type: "announce", announcement: { type: "outputs", readings } },
    ]);
  });
});

describe("connectPins options and refusal", () => {
  it("orients the ends when they come in the other order", () => {
    const { state, context, aOut, nandA } = rig();
    const result = command(state, context, { type: "connectPins", from: nandA, to: aOut });
    expect(dispatched(result.effects)).toEqual([
      expect.objectContaining({ type: "connectWire", from: aOut, to: nandA }),
    ]);
  });

  it("gives the wire its colour, and closes overlays and the old notice", () => {
    const { state, context, aOut, nandA, pieceA } = rig();
    const before = {
      ...withOverlays(state, pieceA.id),
      notice: { type: "OutputToOutput" } as const,
    };
    const result = command(before, context, {
      type: "connectPins",
      from: aOut,
      to: nandA,
      color: "red",
    });
    expect(dispatched(result.effects)).toEqual([expect.objectContaining({ color: "red" })]);
    expect(result.state.card).toBeUndefined();
    expect(result.state.notice).toBeUndefined();
  });

  it("refuses an illegal pair: no edit, and the reason is announced and shown", () => {
    const { state, context, aOut } = rig();
    const result = command(state, context, { type: "connectPins", from: aOut, to: aOut });
    expect(dispatched(result.effects)).toEqual([]);
    const [announcement] = result.effects;
    expect(announcement).toEqual({
      type: "announce",
      announcement: {
        type: "refused",
        reason: { type: "OutputToOutput" },
      },
    });
    expect(result.state.notice).toEqual({ type: "OutputToOutput" });
  });
});
