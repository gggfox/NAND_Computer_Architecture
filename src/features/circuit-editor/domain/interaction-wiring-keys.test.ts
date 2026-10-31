/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import {
  dispatched,
  EMPTY,
  NAND_A,
  NAND_OUT,
  PIN_A_OUT,
  wiring,
} from "./interaction-wiring.fixtures";
import { command, drag, gesture, gestures, tap, WIRE_ID } from "./interaction.fixtures";

describe("wiring keys", () => {
  it("arm arms the pin in the card, else the focused chip's first pin", () => {
    const { context, state, nand, pieceA } = wiring();
    const card = { instanceId: nand.id, pin: 2, screen: NAND_OUT, pinned: true };
    const fromCard = command({ ...state, card }, context, { type: "arm" }).state;
    expect(fromCard.armed?.end).toEqual({ instanceId: nand.id, pin: 2 });
    expect(fromCard.card).toEqual(card);
    const focused = command({ ...state, focus: pieceA.id }, context, { type: "arm" }).state;
    expect(focused.armed?.end).toEqual({ instanceId: pieceA.id, pin: 0 });
    expect(command(state, context, { type: "arm" }).state).toBe(state);
  });

  it("connect wires the armed pin to the pin in the card, or does nothing", () => {
    const { context, state, nand, pieceA } = wiring();
    const card = { instanceId: nand.id, pin: 0, screen: NAND_A, pinned: true };
    expect(command({ ...state, card }, context, { type: "connect" }).state.armed).toBeUndefined();
    const armed = command({ ...state, focus: pieceA.id }, context, { type: "arm" }).state;
    expect(command(armed, context, { type: "connect" }).state).toBe(armed);
    const result = command({ ...armed, card }, context, { type: "connect" });
    expect(dispatched(result.effects)).toEqual([
      expect.objectContaining({
        from: { instanceId: pieceA.id, pin: 0 },
        to: { instanceId: nand.id, pin: 0 },
      }),
    ]);
  });

  it("a bit that is no longer free closes the picker without wiring", () => {
    const { context, state, busIn, pieceA, split } = wiring();
    const picking = gestures(state, context, [tap(PIN_A_OUT), tap(busIn.screen)]).state;
    const used = {
      ...context.scene.circuit,
      wires: [
        ...context.scene.circuit.wires,
        {
          ...context.scene.circuit.wires[0]!,
          id: WIRE_ID,
          from: { instanceId: pieceA.id, pin: 0 },
          to: { instanceId: split.id, pin: busIn.key, bit: 1 },
        },
      ],
    };
    const later = { ...context, scene: { ...context.scene, circuit: used } };
    const result = command(picking, later, { type: "pickBit", bit: 1 });
    expect(dispatched(result.effects)).toEqual([]);
    expect(result.state.bitPick).toBeUndefined();
    expect(result.state.armed).toBeDefined();
  });
});

describe("drags without their armed pin", () => {
  it("a wire drag whose armed pin went away connects nothing", () => {
    const { context, state, pieceA } = wiring();
    const drawing = {
      ...state,
      drag: { kind: "wire", from: { instanceId: pieceA.id, pin: 0 }, point: { x: 0, y: 0 } },
    } as const;
    const released = gesture(drawing, context, { type: "dragEnd", point: NAND_A });
    expect(dispatched(released.effects)).toEqual([]);
  });
});

describe("a wire drag after w armed another pin", () => {
  it("drops onto the pins legal for where the drag started", () => {
    const { context, state, nand, pieceA } = wiring();
    const [start, ...rest] = drag(PIN_A_OUT, NAND_A);
    const dragging = gesture(state, context, start!).state;
    const card = { instanceId: nand.id, pin: 0, screen: NAND_A, pinned: true };
    // `w` arms the NAND's input `a`, from which `a` itself is no target.
    const rearmed = command({ ...dragging, card }, context, { type: "arm" }).state;
    expect(rearmed.armed?.end).toEqual({ instanceId: nand.id, pin: 0 });
    const dropped = gestures(rearmed, context, rest);
    expect(dispatched(dropped.effects)).toEqual([
      expect.objectContaining({
        from: { instanceId: pieceA.id, pin: 0 },
        to: { instanceId: nand.id, pin: 0 },
      }),
    ]);
  });
});

describe("escape with a menu open over an armed pin", () => {
  it("closes the menu first and keeps the pin armed, then disarms", () => {
    const { context, state, pieceA } = wiring();
    const armed = gesture(state, context, tap(PIN_A_OUT)).state;
    const menu = { kind: "canvas", screen: EMPTY } as const;
    const closed = command({ ...armed, menu }, context, { type: "escape" });
    expect(closed.state.menu).toBeUndefined();
    expect(closed.state.armed?.end).toEqual({ instanceId: pieceA.id, pin: 0 });
    const cancelled = command(closed.state, context, { type: "escape" });
    expect(cancelled.state.armed).toBeUndefined();
  });

  it("cancels the armed pin before it closes the pin card that aims it", () => {
    const { context, state, nand } = wiring();
    const card = { instanceId: nand.id, pin: 0, screen: NAND_A, pinned: true };
    const armed = command({ ...state, card }, context, { type: "arm" }).state;
    const cancelled = command(armed, context, { type: "escape" });
    expect(cancelled.state.armed).toBeUndefined();
    expect(cancelled.state.card).toEqual(card);
    expect(command(cancelled.state, context, { type: "escape" }).state.card).toBeUndefined();
  });
});
