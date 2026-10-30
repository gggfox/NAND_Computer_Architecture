/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import type { Point } from "~/features/projects";

import { bendHandles } from "./bend-geometry";
import { interact } from "./interact";
import type { InteractionContext, InteractionState } from "./interaction";
import { dispatched } from "./interaction-wiring.fixtures";
import { command, setup } from "./interaction.fixtures";
import { commandForKey } from "./keymap";
import { selectInstances } from "./selection";

const p = (x: number, y: number): Point => ({ x, y });

const key = (name: string, shift = false) => {
  const found = commandForKey({ key: name, shift, ctrlOrMeta: false, alt: false });
  expect(found).toBeDefined();
  return found!;
};

/**
 * The first demo wire bent by hand: (40,20) → (60,20) → (60,40) → (80,40) → (80,60) → (160,60),
 * in bend mode with its segment 1 (x = 60) focused and the NAND selected.
 */
const bent = (waypoints: readonly Point[] = [p(60, 20), p(60, 40), p(80, 40), p(80, 60)]) => {
  const base = setup();
  const wireId = base.circuit.wires[0]!.id;
  const wires = base.circuit.wires.map((wire) =>
    wire.id === wireId ? { ...wire, waypoints, manualWaypoints: true } : wire,
  );
  const circuit = { ...base.circuit, wires };
  const context: InteractionContext = {
    ...base.context,
    scene: { ...base.context.scene, circuit },
  };
  const state: InteractionState = {
    ...base.state,
    selection: selectInstances([base.nand.id]),
    bends: { wireId, segment: 1 },
  };
  return { ...base, context, state, wireId, circuit };
};

describe("bendHandles", () => {
  it("puts one handle at the middle of each interior segment, for the renderer", () => {
    const { context, wireId } = bent();
    expect(bendHandles(context.scene, wireId)).toEqual([
      { index: 1, centre: p(60, 30), axis: "x" },
      { index: 2, centre: p(70, 40), axis: "y" },
      { index: 3, centre: p(80, 50), axis: "x" },
    ]);
    const { context: plain, circuit } = setup();
    const gone = { ...plain.scene, circuit: { ...circuit, wires: [] } };
    expect(bendHandles(gone, wireId)).toEqual([]);
  });
});

describe("bend mode keys", () => {
  it("] and [ step the focused segment, wrapping, and leave the chip selection", () => {
    const { context, state } = bent();
    const segmentAfter = (names: readonly string[]) =>
      names.reduce((acc, name) => command(acc, context, key(name)).state, state);
    expect(segmentAfter(["]"]).bends?.segment).toBe(2);
    expect(segmentAfter(["]", "]", "]"]).bends?.segment).toBe(1);
    expect(segmentAfter(["["]).bends?.segment).toBe(3);
    expect(segmentAfter(["]"]).selection).toBe(state.selection);
  });

  it("an arrow across the focused segment moves it one cell as one moveWaypoint", () => {
    const { context, state, wireId } = bent();
    const result = command(state, context, key("ArrowRight"));
    expect(dispatched(result.effects)).toEqual([
      {
        type: "moveWaypoint",
        chipId: context.chipId,
        wireId,
        // Segment x = 60 moves to 80, where it meets segment 3 and merges with it.
        waypoints: [p(80, 20), p(80, 60)],
      },
    ]);
    const down = command({ ...state, bends: { wireId, segment: 2 } }, context, key("ArrowDown"));
    expect(dispatched(down.effects)).toEqual([
      expect.objectContaining({ waypoints: [p(60, 20), p(60, 60)] }),
    ]);
  });

  it("an arrow along the focused segment does nothing", () => {
    const { context, state } = bent();
    for (const name of ["ArrowUp", "ArrowDown"]) {
      const result = command(state, context, key(name));
      expect(result.state).toBe(state);
      expect(result.effects).toEqual([]);
    }
  });

  it("other keys act as usual in bend mode", () => {
    const { context, state } = bent();
    const zoomed = command(state, context, key("+"));
    expect(zoomed.state.camera.zoom).toBeGreaterThan(1);
    expect(zoomed.state.bends).toBe(state.bends);
  });
});

describe("bend mode without handles or with wiring", () => {
  it("a wire with no interior segment enters bend mode, but its keys do nothing", () => {
    const { context, state, wireId } = bent([p(160, 20)]);
    const { bends: _bends, ...outside } = state;
    const entered = command(outside, context, { type: "editBends", wireId }).state;
    expect(entered.bends).toEqual({ wireId, segment: 1 });
    for (const name of ["]", "ArrowRight"]) {
      const result = command(entered, context, key(name));
      expect(result.state).toBe(entered);
      expect(result.effects).toEqual([]);
    }
    expect(interact(entered, { type: "historyChanged" }, context).state.bends).toEqual(
      entered.bends,
    );
  });

  it("Escape cancels an armed pin before it leaves bend mode", () => {
    const { context, state, pieceA } = bent();
    const armed = command({ ...state, focus: pieceA.id }, context, { type: "arm" }).state;
    const disarmed = command(armed, context, key("Escape")).state;
    expect(disarmed.armed).toBeUndefined();
    expect(disarmed.bends).toBe(state.bends);
    expect(command(disarmed, context, key("Escape")).state.bends).toBeUndefined();
  });

  it("after an edit a focused segment that is gone moves to the first", () => {
    const { context, state, wireId } = bent();
    const { circuit } = context.scene;
    const wires = circuit.wires.map((wire) =>
      wire.id === wireId ? { ...wire, waypoints: [p(60, 20), p(60, 60)] } : wire,
    );
    const merged = { ...context, scene: { ...context.scene, circuit: { ...circuit, wires } } };
    const stale = { ...state, bends: { wireId, segment: 3 } };
    const after = interact(stale, { type: "historyChanged" }, merged).state;
    expect(after.bends).toEqual({ wireId, segment: 1 });
    expect(interact(stale, { type: "historyChanged" }, context).state.bends).toBe(stale.bends);
  });
});
