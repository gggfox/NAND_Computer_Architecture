import { assert, describe, expect, it } from "vitest";

import { EMPTY_CIRCUIT } from "~/features/projects";
import type { ChipInstance } from "~/features/projects";
import { newInstanceId } from "~/shared/ids";

import { buildIndex } from "./hit-test";
import { interact } from "./interact";
import type { Effect, InteractionContext } from "./interaction";
import { command, gesture, NONE, screen, setup, tap } from "./interaction.fixtures";

const SHIFT = { ...NONE, shift: true };

const setInputs = (effects: readonly Effect[]) =>
  effects.filter((effect) => effect.type === "setInput");

const pinIdOf = (instance: ChipInstance) => {
  assert(instance.kind.type === "pin");
  return instance.kind.pinId;
};

describe("tapping an input piece", () => {
  it("a tap on A's body sets it to 1 and selects it; a second tap sets it to 0", () => {
    const { state, context, pieceA } = setup();
    const first = gesture(state, context, tap(screen(20, 20)));
    expect(setInputs(first.effects)).toEqual([
      { type: "setInput", pinId: pinIdOf(pieceA), value: 1 },
    ]);
    expect([...first.state.selection.instances]).toEqual([pieceA.id]);
    const raised: InteractionContext = {
      ...context,
      inputs: new Map([[pinIdOf(pieceA), 1]]),
    };
    const second = gesture(first.state, raised, tap(screen(20, 20)));
    expect(setInputs(second.effects)).toEqual([
      { type: "setInput", pinId: pinIdOf(pieceA), value: 0 },
    ]);
  });

  it("shift-tap only selects", () => {
    const { state, context, pieceA } = setup();
    const { effects, state: after } = gesture(state, context, tap(screen(20, 20), "mouse", SHIFT));
    expect(setInputs(effects)).toEqual([]);
    expect([...after.selection.instances]).toEqual([pieceA.id]);
  });

  it("a tap on the output OUT sets nothing", () => {
    const { state, context } = setup();
    const onOut = tap(screen(340, 60));
    expect(setInputs(gesture(state, context, onOut).effects)).toEqual([]);
  });
});

/** The demo with A made 8 bits wide: its body is x -40..40, y 0..80, switches along the bottom. */
const wideA = () => {
  const { state, context, pieceA } = setup();
  const { circuit } = context.scene;
  const pins = circuit.pins.map((pin) =>
    pin.id === pinIdOf(pieceA) ? { ...pin, width: 8 as const } : pin,
  );
  const scene = { ...context.scene, circuit: { ...circuit, pins } };
  const index = () => buildIndex(scene);
  return { state, context: { ...context, scene, index }, pinId: pinIdOf(pieceA) };
};

describe("tapping a wide input piece", () => {
  it("a tap on a switch flips that bit: top-left is the most significant", () => {
    const { state, context, pinId } = wideA();
    const top = gesture(state, context, tap(screen(-27, 49)));
    expect(setInputs(top.effects)).toEqual([{ type: "setInput", pinId, value: 128 }]);
    const raised: InteractionContext = { ...context, inputs: new Map([[pinId, 128]]) };
    const last = gesture(top.state, raised, tap(screen(27, 67)));
    expect(setInputs(last.effects)).toEqual([{ type: "setInput", pinId, value: 129 }]);
  });

  it("a tap off the switches only selects", () => {
    const { state, context } = wideA();
    const { effects, state: after } = gesture(state, context, tap(screen(0, 20)));
    expect(setInputs(effects)).toEqual([]);
    expect(after.selection.instances.size).toBe(1);
  });
});

describe("renaming a pin piece", () => {
  it("a tap on A's label opens the rename popover at the label", () => {
    const { state, context, pieceA } = setup();
    const { state: after, effects } = gesture(state, context, tap(screen(-12, 20)));
    expect(after.renaming).toEqual({ instanceId: pieceA.id, screen: screen(-16, 30) });
    expect(setInputs(effects)).toEqual([]);
  });

  it("startRename opens it for a piece; for a chip that is not a piece it does nothing", () => {
    const { state, context, pieceB, nand } = setup();
    const opened = command(state, context, { type: "startRename", instanceId: pieceB.id });
    expect(opened.state.renaming?.instanceId).toBe(pieceB.id);
    expect(command(state, context, { type: "startRename", instanceId: nand.id }).state).toBe(state);
    const missing = command(state, context, { type: "startRename", instanceId: newInstanceId() });
    expect(missing.state).toBe(state);
  });

  it("endRename closes it, a tap elsewhere closes it, and so does losing the piece", () => {
    const { state, context, pieceA } = setup();
    const { state: open } = command(state, context, { type: "startRename", instanceId: pieceA.id });
    expect(command(open, context, { type: "endRename" }).state.renaming).toBeUndefined();
    const away = tap(screen(600, 500));
    expect(gesture(open, context, away).state.renaming).toBeUndefined();
    const gone = { ...context, scene: { ...context.scene, circuit: EMPTY_CIRCUIT } };
    expect(interact(open, { type: "historyChanged" }, gone).state.renaming).toBeUndefined();
    expect(interact(open, { type: "historyChanged" }, context).state.renaming).toBeDefined();
  });
});

describe("selectPieces", () => {
  it("selects the pieces and focuses the first", () => {
    const { state, context, pieceB } = setup();
    const { state: after, effects } = command(state, context, {
      type: "selectPieces",
      instanceIds: [pieceB.id],
    });
    expect([...after.selection.instances]).toEqual([pieceB.id]);
    expect(after.focus).toBe(pieceB.id);
    expect(effects).toContainEqual({
      type: "announce",
      announcement: { type: "selected", instanceIds: [pieceB.id], wires: 0 },
    });
  });

  it("with no pieces it clears the selection and keeps the focus", () => {
    const { state, context, pieceB } = setup();
    const { state: picked } = command(state, context, {
      type: "selectPieces",
      instanceIds: [pieceB.id],
    });
    const { state: after } = command(picked, context, { type: "selectPieces", instanceIds: [] });
    expect(after.selection.instances.size).toBe(0);
    expect(after.focus).toBe(pieceB.id);
  });
});
