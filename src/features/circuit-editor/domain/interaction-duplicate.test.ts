/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import type { EditorAction } from "./actions";
import { arrayDeltas } from "./array";
import type { ArrayRequest } from "./array";
import { GRID } from "./geometry";
import type { Effect } from "./interaction";
import { command, setup } from "./interaction.fixtures";
import { selectInstances, EMPTY_SELECTION } from "./selection";

const dispatches = (effects: readonly Effect[]): readonly EditorAction[] =>
  effects.flatMap((effect) => (effect.type === "dispatch" ? [effect.action] : []));

const announcements = (effects: readonly Effect[]) =>
  effects.flatMap((effect) => (effect.type === "announce" ? [effect.announcement] : []));

const twoSelected = () => {
  const { context, state, pieceA, nand } = setup();
  return {
    context,
    pieceA,
    nand,
    state: { ...state, selection: selectInstances([pieceA.id, nand.id]) },
  };
};

const ROW: ArrayRequest = { count: 3, direction: "row", columns: 1, spacing: 1 };

describe("duplicate", () => {
  it("adds copies one grid step down and right, selects them and says so", () => {
    const { context, state, pieceA, nand } = twoSelected();
    const result = command(state, context, { type: "duplicate" });
    const [action, ...more] = dispatches(result.effects);
    assert(action?.type === "pasteItems");
    expect(more).toHaveLength(0);
    expect(action.instances.map((item) => item.position)).toEqual([
      { x: pieceA.position.x + GRID, y: pieceA.position.y + GRID },
      { x: nand.position.x + GRID, y: nand.position.y + GRID },
    ]);
    expect(result.state.selection.instances).toEqual(new Set(action.instances.map((i) => i.id)));
    expect(result.state.selection.wires).toEqual(new Set(action.wires.map((w) => w.id)));
    expect(announcements(result.effects)).toContainEqual({
      type: "clipboard",
      did: "duplicate",
      count: 2,
    });
  });

  it("does nothing without a selected piece", () => {
    const { context, state } = setup();
    const result = command(state, context, { type: "duplicate" });
    expect(result.effects).toEqual([]);
    expect(result.state).toBe(state);
    const wires = command({ ...state, selection: EMPTY_SELECTION }, context, {
      type: "duplicate",
    });
    expect(dispatches(wires.effects)).toEqual([]);
  });

  it("leaves the clipboard alone", () => {
    const { context, state } = twoSelected();
    const copied = command(state, context, { type: "copy" }).state;
    const after = command(copied, context, { type: "duplicate" }).state;
    expect(after.clipboard).toBe(copied.clipboard);
    const none = command(state, context, { type: "duplicate" }).state;
    expect(none.clipboard).toBeUndefined();
  });
});

describe("showArray and hideArray", () => {
  it("does nothing without selected pieces", () => {
    const { context, state } = setup();
    const result = command(state, context, { type: "showArray" });
    expect(result.state).toBe(state);
    expect(result.effects).toEqual([]);
  });

  it("opens the dialog, and hideArray closes it", () => {
    const { context, state } = twoSelected();
    const shown = command(state, context, { type: "showArray" }).state;
    expect(shown.arraying).toBe(true);
    const hidden = command(shown, context, { type: "hideArray" }).state;
    expect(hidden.arraying).toBeUndefined();
    expect("arraying" in hidden).toBe(false);
  });
});

describe("array", () => {
  it("adds every copy as one edit at the offsets for the selection's bounds", () => {
    const { context, state, pieceA, nand } = twoSelected();
    const shown = command(state, context, { type: "showArray" }).state;
    const result = command(shown, context, { type: "array", request: ROW });
    const [action, ...more] = dispatches(result.effects);
    assert(action?.type === "pasteItems");
    expect(more).toHaveLength(0);
    expect(action.instances).toHaveLength(6);
    // A (0,0) to NAND (160..280, 40..120): bounds 280 x 120.
    const deltas = arrayDeltas(ROW, { width: 280, height: 120 });
    expect(action.instances.map((item) => item.position)).toEqual(
      deltas.flatMap((delta) => [
        { x: pieceA.position.x + delta.x, y: pieceA.position.y + delta.y },
        { x: nand.position.x + delta.x, y: nand.position.y + delta.y },
      ]),
    );
    expect(result.state.arraying).toBeUndefined();
  });
});

describe("array selection", () => {
  it("selects originals and copies and says so", () => {
    const { context, state, pieceA, nand } = twoSelected();
    const result = command(state, context, { type: "array", request: ROW });
    const [action] = dispatches(result.effects);
    assert(action?.type === "pasteItems");
    const ids = new Set([pieceA.id, nand.id, ...action.instances.map((item) => item.id)]);
    expect(result.state.selection.instances).toEqual(ids);
    expect([...result.state.selection.wires]).toEqual(
      expect.arrayContaining(action.wires.map((w) => w.id)),
    );
    expect(announcements(result.effects)).toContainEqual({
      type: "clipboard",
      did: "array",
      count: 6,
    });
  });

  it("keeps the originally selected wires selected", () => {
    const { context, state } = twoSelected();
    const { circuit } = setup();
    const [first] = circuit.wires;
    assert(first);
    const withWire = {
      ...state,
      selection: { ...state.selection, wires: new Set([first.id]) },
    };
    const result = command(withWire, context, { type: "array", request: ROW });
    expect(result.state.selection.wires.has(first.id)).toBe(true);
  });

  it("does nothing without a selected piece", () => {
    const { context, state } = setup();
    const result = command({ ...state, arraying: true }, context, { type: "array", request: ROW });
    expect(dispatches(result.effects)).toEqual([]);
    expect(result.state.arraying).toBeUndefined();
  });
});
