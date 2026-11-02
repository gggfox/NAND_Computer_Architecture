/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import { buildIndex } from "./hit-test";
import { previewOf } from "./interaction";
import {
  dispatched,
  EMPTY,
  NAND_A,
  NAND_BODY,
  NAND_OUT,
  PIN_A_OUT,
  wiring,
} from "./interaction-wiring.fixtures";
import { command, drag, gesture, gestures, screen, tap, WIRE_ID } from "./interaction.fixtures";
import { pinLevelKey } from "./signals";

describe("arming by tap", () => {
  it("tapping a pin arms it with its legal targets", () => {
    const { context, state, pieceA, nand } = wiring();
    const result = gesture(state, context, tap(PIN_A_OUT, "touch"));
    expect(result.state.armed?.end).toEqual({ instanceId: pieceA.id, pin: 0 });
    expect(result.state.armed?.legal.has(pinLevelKey(nand.id, 0))).toBe(true);
    expect(result.state.armed?.legal.has(pinLevelKey(nand.id, 1))).toBe(false);
    expect(result.state.armed?.color).toBeUndefined();
    expect(result.effects).toEqual([
      { type: "announce", announcement: { type: "armed", instanceId: pieceA.id, pin: 0 } },
    ]);
  });

  it("tapping a legal pin connects with the next wire colour", () => {
    const { context, state, pieceA, nand } = wiring();
    const teal = command(state, context, { type: "setWireColor", color: "teal" }).state;
    const result = gestures(teal, context, [tap(PIN_A_OUT), tap(NAND_A)]);
    expect(result.state.armed).toBeUndefined();
    expect(dispatched(result.effects)).toEqual([
      {
        type: "connectWire",
        chipId: context.chipId,
        wireId: WIRE_ID,
        from: { instanceId: pieceA.id, pin: 0 },
        to: { instanceId: nand.id, pin: 0 },
        color: "teal",
      },
    ]);
    expect(result.effects.at(-1)).toEqual({ type: "announce", announcement: { type: "wired" } });
    const cleared = command(teal, context, { type: "setWireColor" }).state;
    expect(cleared.wireColor).toBeUndefined();
  });
});

describe("a second tap while armed", () => {
  it("tapping an illegal pin re-arms it", () => {
    const { context, state, nand, pieceA } = wiring();
    // The NAND output cannot drive A's output: it becomes the armed pin instead.
    const result = gestures(state, context, [tap(NAND_OUT), tap(PIN_A_OUT)]);
    expect(dispatched(result.effects)).toEqual([]);
    const again = gestures(state, context, [tap(PIN_A_OUT), tap(NAND_OUT)]);
    expect(again.state.armed?.end).toEqual({ instanceId: nand.id, pin: 2 });
    expect(result.state.armed?.end).toEqual({ instanceId: pieceA.id, pin: 0 });
  });

  it("tapping empty canvas cancels", () => {
    const { context, state } = wiring();
    const result = gestures(state, context, [tap(PIN_A_OUT), tap(EMPTY)]);
    expect(result.state.armed).toBeUndefined();
    expect(result.effects.at(-1)).toEqual({
      type: "announce",
      announcement: { type: "disarmed" },
    });
  });

  it("tapping a chip body cancels and selects it", () => {
    const { context, state, nand, circuit } = wiring();
    const result = gestures(state, context, [tap(PIN_A_OUT), tap(NAND_BODY)]);
    expect(result.state.armed).toBeUndefined();
    expect([...result.state.selection.instances]).toEqual([nand.id]);
    expect(result.effects.slice(-2)).toEqual([
      { type: "announce", announcement: { type: "disarmed" } },
      { type: "announce", announcement: { type: "selected", instanceIds: [nand.id], wires: 0 } },
    ]);
    const wireTap = gestures(state, context, [tap(PIN_A_OUT), tap(screen(100, 100))]);
    expect([...wireTap.state.selection.wires]).toEqual([circuit.wires[0]?.id]);
  });
});

describe("wire drags", () => {
  it("a drag from a pin draws a wire and connects on release over a legal pin within reach", () => {
    const { context, state, pieceA, nand } = wiring();
    const [start, move, end] = drag(PIN_A_OUT, screen(150, 64));
    const drawing = gestures(state, context, [start!, move!]);
    expect(drawing.state.drag).toEqual({
      kind: "wire",
      from: { instanceId: pieceA.id, pin: 0 },
      point: { x: 150, y: 64 },
    });
    expect(dispatched(drawing.effects)).toEqual([]);
    expect(previewOf(drawing.state, context.scene).size).toBe(0);
    const released = gesture(drawing.state, context, end!);
    expect(released.state.drag).toBeUndefined();
    expect(dispatched(released.effects)).toEqual([
      expect.objectContaining({
        type: "connectWire",
        from: { instanceId: pieceA.id, pin: 0 },
        to: { instanceId: nand.id, pin: 0 },
      }),
    ]);
    // A chip under the start of the drag is not moved.
    expect(dispatched(released.effects).some((action) => action.type === "moveChips")).toBe(false);
  });

  it("a drag from a pin released elsewhere connects nothing", () => {
    const { context, state } = wiring();
    const released = gestures(state, context, drag(PIN_A_OUT, screen(100, 300)));
    expect(dispatched(released.effects)).toEqual([]);
    expect(released.state.armed).toBeUndefined();
    // Over an illegal pin (the NAND's input b, which B already drives) nothing connects either.
    const onB = gestures(state, context, drag(PIN_A_OUT, screen(160, 100)));
    expect(dispatched(onB.effects)).toEqual([]);
    const [start] = drag(PIN_A_OUT, EMPTY);
    const cancelled = gestures(state, context, [start!, { type: "dragCancel" }]);
    expect(cancelled.state.armed).toBeUndefined();
    expect(cancelled.state.drag).toBeUndefined();
  });
});

describe("branching", () => {
  it("a drag from a wire branches with the wire's colour", () => {
    const { context, state, circuit, nand } = wiring();
    const outWire = circuit.wires.find((item) => item.from.instanceId === nand.id);
    assert(outWire !== undefined);
    const colored = { ...outWire, color: "red" as const };
    const recolored = {
      ...circuit,
      wires: circuit.wires.map((item) => (item.id === outWire.id ? colored : item)),
    };
    const scene = { ...context.scene, circuit: recolored };
    const branchContext = { ...context, scene, index: () => buildIndex(scene) };
    const blue = { ...state, wireColor: "blue" as const };
    const result = gestures(blue, branchContext, drag(screen(300, 70), NAND_A));
    expect(dispatched(result.effects)).toEqual([
      expect.objectContaining({
        type: "connectWire",
        from: outWire.from,
        to: { instanceId: nand.id, pin: 0 },
        color: "red",
      }),
    ]);
  });
});

describe("the bit picker", () => {
  it("a target needing a bit opens the bit picker and pickBit connects", () => {
    const { context, state, pieceA, split, busIn } = wiring();
    const picking = gestures(state, context, [tap(PIN_A_OUT), tap(busIn.screen)]);
    expect(picking.state.bitPick).toEqual({
      armed: { instanceId: pieceA.id, pin: 0 },
      target: { instanceId: split.id, pin: busIn.key },
      bus: "target",
      bits: [0, 1, 2, 3],
      screen: busIn.screen,
    });
    expect(picking.state.armed).toBeDefined();
    expect(command(picking.state, context, { type: "pickBit", bit: 9 }).state).toBe(picking.state);
    const picked = command(picking.state, context, { type: "pickBit", bit: 2 });
    expect(picked.state.bitPick).toBeUndefined();
    expect(picked.state.armed).toBeUndefined();
    expect(dispatched(picked.effects)).toEqual([
      expect.objectContaining({
        type: "connectWire",
        from: { instanceId: pieceA.id, pin: 0 },
        to: { instanceId: split.id, pin: busIn.key, bit: 2 },
      }),
    ]);
  });

  it("escape closes the picker, then disarms", () => {
    const { context, state, busIn } = wiring();
    const picking = gestures(state, context, [tap(PIN_A_OUT), tap(busIn.screen)]).state;
    const closed = command(picking, context, { type: "escape" });
    expect(closed.state.bitPick).toBeUndefined();
    expect(closed.state.armed).toBeDefined();
    expect(closed.effects).toEqual([]);
    const cancelled = command(closed.state, context, { type: "escape" });
    expect(cancelled.state.armed).toBeUndefined();
    expect(cancelled.effects).toEqual([{ type: "announce", announcement: { type: "disarmed" } }]);
  });
});

describe("drags that do not wire", () => {
  it("Space held on a pin pans instead", () => {
    const { context, state } = wiring();
    const space = { shift: false, alt: false, ctrlOrMeta: false, space: true };
    const result = gestures(state, context, drag(PIN_A_OUT, screen(80, 20), space));
    expect(result.state.armed).toBeUndefined();
    expect(result.state.camera).toEqual({ zoom: 1, x: -40, y: 0 });
  });
});

describe("what keeps the armed pin", () => {
  it("pinch keeps the armed pin", () => {
    const { context, state, busIn } = wiring();
    const picking = gestures(state, context, [tap(PIN_A_OUT), tap(busIn.screen)]).state;
    const pinched = gestures(picking, context, [
      { type: "pinchStart", center: screen(0, 0) },
      { type: "pinch", center: screen(0, 0), scale: 2, pan: { x: 0, y: 0 } },
      { type: "pinchEnd" },
    ]).state;
    expect(picking.armed).toBeDefined();
    expect(pinched.armed).toEqual(picking.armed);
    expect(pinched.bitPick).toBeUndefined();
  });

  it("a drag on a chip body still moves it", () => {
    const { context, state, nand } = wiring();
    const result = gestures(state, context, drag(NAND_BODY, screen(305, 83)));
    expect(dispatched(result.effects)).toEqual([
      {
        type: "moveChips",
        chipId: context.chipId,
        moves: [{ instanceId: nand.id, position: { x: 240, y: 40 } }],
      },
    ]);
  });
});
