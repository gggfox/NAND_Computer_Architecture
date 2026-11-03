/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import { pinOf } from "./interaction-pin-select.fixtures";
import { dismissGhosts } from "./interaction-suggest";
import {
  dispatches,
  endOf,
  fileContext,
  middleOf,
  suggested,
} from "./interaction-suggest.fixtures";
import { command, gesture, setup, tap } from "./interaction.fixtures";
import { selectInstances } from "./selection";

const note = (announcement: object) => ({ type: "announce", announcement });

const busyState = () => {
  const { state, context, regs, ghosts } = suggested();
  const [first] = regs;
  assert(first !== undefined);
  const busy = {
    ...state,
    selection: selectInstances([first.id]),
    card: { ...pinOf(first), screen: { x: 1, y: 1 }, pinned: true },
    menu: { kind: "canvas", screen: { x: 1, y: 1 } },
    armed: { end: pinOf(first), legal: new Set<string>() },
    placing: { type: "nand" },
    suggestions: { ghosts: ghosts.slice(0, 1), focus: 0 },
  } as const;
  return { busy, context };
};

describe("suggestWires", () => {
  it("shows every ghost, announces the count and never dispatches", () => {
    const { state, context } = fileContext();
    const result = command(state, context, { type: "suggestWires" });
    expect(result.state.suggestions?.ghosts).toHaveLength(20);
    expect(result.effects).toEqual([note({ type: "suggested", count: 20 })]);
  });

  it("with chips selected, shows only theirs and keeps the selection", () => {
    const { state, context, regs } = fileContext();
    const [first] = regs;
    assert(first !== undefined);
    const picked = { ...state, selection: selectInstances([first.id]) };
    const result = command(picked, context, { type: "suggestWires" });
    expect(result.state.suggestions?.ghosts).toHaveLength(5);
    expect(result.state.selection).toBe(picked.selection);
  });

  it("with nothing to propose, shows none and says so, dropping the old ones", () => {
    const demo = setup();
    const old = { ghosts: [], focus: 0 };
    const result = command({ ...demo.state, suggestions: old }, demo.context, {
      type: "suggestWires",
    });
    expect(result.state.suggestions).toBeUndefined();
    expect(result.effects).toEqual([note({ type: "suggested", count: 0 })]);
  });

  it("closes the card and menu, disarms, stops a placement and replaces earlier ghosts", () => {
    const { busy, context } = busyState();
    const result = command(busy, context, { type: "suggestWires" });
    expect(result.state).toMatchObject({ selection: busy.selection });
    expect(result.state.suggestions?.focus).toBeUndefined();
    expect(result.state.suggestions?.ghosts).toHaveLength(5);
    for (const gone of ["card", "menu", "armed", "placing", "bitPick"] as const) {
      expect(result.state[gone]).toBeUndefined();
    }
  });
});

describe("accepting", () => {
  it("one ghost dispatches one connectWires, keeps the others and marks the new wire", () => {
    const { state, context, ghosts } = suggested();
    const colored = { ...state, wireColor: "red" } as const;
    const result = command(colored, context, { type: "acceptGhost", index: 3 });
    const [dispatch, ...extra] = dispatches(result);
    expect(extra).toEqual([]);
    expect(dispatch).toMatchObject({
      action: {
        type: "connectWires",
        chipId: context.chipId,
        color: "red",
        wires: [{ from: ghosts[3]?.from, to: ghosts[3]?.to }],
      },
    });
    expect(result.state.suggestions?.ghosts).toHaveLength(19);
    expect(result.state.suggestions?.accepting).toHaveLength(1);
    expect(result.state.suggestions?.focus).toBeUndefined();
    expect(result.effects).toContainEqual(note({ type: "accepted", count: 1 }));
  });

  it("without an index takes the focused ghost, and with none focused does nothing", () => {
    const { state, context, ghosts } = suggested();
    const unfocused = command(state, context, { type: "acceptGhost" });
    expect(unfocused).toEqual({ state, effects: [] });
    const focused = { ...state, suggestions: { ghosts, focus: 2 } };
    const result = command(focused, context, { type: "acceptGhost" });
    expect(dispatches(result)).toHaveLength(1);
    expect(result.state.suggestions?.focus).toBe(2);
  });

  it("does nothing for a missing ghost or when none show", () => {
    const { state, context, ghosts } = suggested();
    const focused = { ...state, suggestions: { ghosts, focus: 2 } };
    const missing = command(focused, context, { type: "acceptGhost", index: 99 });
    expect(missing).toEqual({ state: focused, effects: [] });
    const none = fileContext();
    const result = command(none.state, none.context, { type: "acceptGhost", index: 0 });
    expect(result.effects).toEqual([]);
  });
});

describe("the focus after accepting one", () => {
  it("keeps the focus on the same ghost, wrapping past the end", () => {
    const { state, context, ghosts } = suggested();
    const last = ghosts.length - 1;
    const atEnd = { ...state, suggestions: { ghosts, focus: last } };
    expect(command(atEnd, context, { type: "acceptGhost" }).state.suggestions?.focus).toBe(0);
    const before = { ...state, suggestions: { ghosts, focus: 5 } };
    const result = command(before, context, { type: "acceptGhost", index: 1 });
    expect(result.state.suggestions?.focus).toBe(4);
  });

  it("the last ghost leaves no suggestions", () => {
    const { state, context, ghosts } = suggested();
    const [only] = ghosts;
    assert(only !== undefined);
    const result = command({ ...state, suggestions: { ghosts: [only] } }, context, {
      type: "acceptGhost",
      index: 0,
    });
    expect(result.state.suggestions).toBeUndefined();
    expect(dispatches(result)).toHaveLength(1);
  });
});

describe("accepting all", () => {
  it("accept all dispatches every remaining ghost in one action and ends the suggestions", () => {
    const { state, context, ghosts } = suggested();
    const result = command(state, context, { type: "acceptAllGhosts" });
    const [dispatch, ...extra] = dispatches(result);
    expect(extra).toEqual([]);
    expect(dispatch).toMatchObject({ action: { type: "connectWires" } });
    const wires = dispatch?.action.type === "connectWires" ? dispatch.action.wires : [];
    expect(wires).toHaveLength(20);
    expect(result.state.suggestions).toBeUndefined();
    expect(result.effects).toContainEqual(note({ type: "accepted", count: ghosts.length }));
  });

  it("does nothing when no ghosts show", () => {
    const none = fileContext();
    const result = command(none.state, none.context, { type: "acceptAllGhosts" });
    expect(result.effects).toEqual([]);
  });
});

describe("dismissing and cycling", () => {
  it("dismiss drops the ghosts, announces it and dispatches nothing", () => {
    const { state, context } = suggested();
    const result = command(state, context, { type: "dismissGhosts" });
    expect(result.state.suggestions).toBeUndefined();
    expect(result.effects).toEqual([note({ type: "dismissed" })]);
    expect(dismissGhosts(result.state)).toBeUndefined();
    expect(command(result.state, context, { type: "dismissGhosts" }).effects).toEqual([]);
  });
});

describe("cycling", () => {
  it("next focuses 0, 1, wraps, and goes backwards from none to the last", () => {
    const { state, context, ghosts } = suggested();
    const next = { type: "nextGhost", backwards: false } as const;
    const first = command(state, context, next);
    expect(first.state.suggestions?.focus).toBe(0);
    expect(first.effects).toContainEqual(
      note({ type: "ghostFocused", index: 0, count: 20, ghost: ghosts[0] }),
    );
    expect(command(first.state, context, next).state.suggestions?.focus).toBe(1);
    const atEnd = { ...state, suggestions: { ghosts, focus: 19 } };
    expect(command(atEnd, context, next).state.suggestions?.focus).toBe(0);
  });

  it("goes backwards from none to the last ghost, and does nothing without ghosts", () => {
    const { state, context } = suggested();
    const back = command(state, context, { type: "nextGhost", backwards: true });
    expect(back.state.suggestions?.focus).toBe(19);
    expect(dispatches(back)).toEqual([]);
    const none = fileContext();
    const result = command(none.state, none.context, { type: "nextGhost", backwards: false });
    expect(result).toEqual({ state: none.state, effects: [] });
  });

  it("moves the camera to a ghost that is off screen, and not to one in view", () => {
    const { state, context } = suggested();
    const next = { type: "nextGhost", backwards: false } as const;
    const small = { ...context, viewport: { width: 4000, height: 4000 } };
    expect(command(state, small, next).effects).not.toContainEqual({ type: "cameraSettled" });
    const far = { ...state, camera: { zoom: 1, x: 5000, y: 5000 } };
    const result = command(far, context, next);
    expect(result.state.camera).not.toEqual(far.camera);
    expect(result.effects).toContainEqual({ type: "cameraSettled" });
  });

  it("leaves the camera alone for a ghost with no route", () => {
    const { state, context, ghosts } = suggested();
    const [ghost] = ghosts;
    assert(ghost !== undefined);
    const bare = { ...state, suggestions: { ghosts: [{ ...ghost, route: [] }] } };
    const result = command(bare, context, { type: "nextGhost", backwards: false });
    expect(result.effects).toEqual([
      note({ type: "ghostFocused", index: 0, count: 1, ghost: { ...ghost, route: [] } }),
    ]);
  });
});

describe("tapping a ghost", () => {
  it("accepts the ghost under the tap", () => {
    const { state, context, ghosts } = suggested();
    const [ghost] = ghosts;
    assert(ghost !== undefined);
    const result = gesture(state, context, tap(middleOf(state, ghost)));
    expect(dispatches(result)).toHaveLength(1);
    expect(result.state.suggestions?.accepting).toHaveLength(1);
  });

  it("leaves a tap on an end pin, on empty canvas, or with no ghosts to the usual handling", () => {
    const { state, context, ghosts } = suggested();
    const [ghost] = ghosts;
    assert(ghost !== undefined);
    const onPin = gesture(state, context, tap(endOf(context, state, ghost)));
    expect(dispatches(onPin)).toEqual([]);
    expect(onPin.state.suggestions).toBeDefined();
    expect(onPin.state.armed).toBeDefined();
  });

  it("ignores a tap on empty canvas, and any tap without ghosts", () => {
    const { state, context } = suggested();
    const empty = gesture(state, context, tap({ x: 3000, y: 3000 }));
    expect(empty.state.suggestions).toBeDefined();
    expect(dispatches(empty)).toEqual([]);
    const quiet = fileContext();
    const result = gesture(quiet.state, quiet.context, tap({ x: 60, y: 60 }));
    expect(dispatches(result)).toEqual([]);
  });

  it("leaves a tap to a placement or an armed pin, which own the next tap", () => {
    const { state, context, ghosts, regs } = suggested();
    const [ghost] = ghosts;
    const [first] = regs;
    assert(ghost !== undefined && first !== undefined);
    const point = middleOf(state, ghost);
    const armed = { end: pinOf(first), legal: new Set<string>() };
    const busy = [{ ...state, placing: { type: "nand" } } as const, { ...state, armed }];
    for (const result of busy.map((item) => gesture(item, context, tap(point)))) {
      expect(result.state.suggestions?.accepting).toBeUndefined();
      expect(dispatches(result).some((effect) => effect.action.type === "connectWires")).toBe(
        false,
      );
    }
  });
});
