/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import type { Point } from "~/features/projects";

import { moveSegment } from "./bend-geometry";
import { interact } from "./interact";
import type { InteractionState } from "./interaction";
import { dispatched } from "./interaction-wiring.fixtures";
import { NONE, command, drag, gesture, gestures, screen, setup, tap } from "./interaction.fixtures";

const p = (x: number, y: number): Point => ({ x, y });

/** Every segment of `points` runs along x or along y. */
const orthogonal = (points: readonly Point[]): boolean =>
  points.every((point, at) => {
    const next = points[at + 1];
    return next === undefined || next.x === point.x || next.y === point.y;
  });

const BENDS_DONE = { type: "announce", announcement: { type: "bends", active: false } };

/** The first demo wire runs (40,20) → (100,20) → (100,60) → (160,60): its handle is at (100,40). */
const HANDLE = screen(100, 40);

const bending = (tool: "select" | "pan" = "select") => {
  const base = setup(tool);
  const wireId = base.circuit.wires[0]!.id;
  const state: InteractionState = { ...base.state, bends: { wireId, segment: 1 } };
  return { ...base, state, wireId };
};

describe("moveSegment", () => {
  const route = [p(0, 0), p(20, 0), p(20, 100), p(200, 100)];

  it("moveSegment keeps right angles and snaps to the half-grid", () => {
    const moved = moveSegment(route, 1, 47);
    expect(moved).toEqual([p(60, 0), p(60, 100)]);
    expect(orthogonal([route[0]!, ...moved, route[3]!])).toBe(true);
    expect(moveSegment(route, 1, 9)).toEqual([p(20, 0), p(20, 100)]);
    expect(moveSegment(route, 1, 11)).toEqual([p(40, 0), p(40, 100)]);
  });

  it("moveSegment never moves the stubs", () => {
    for (const index of [0, 2, -1, 7]) {
      expect(moveSegment(route, index, 40)).toEqual([p(20, 0), p(20, 100)]);
    }
    // Pulled back past the first stub's end, the segment stops there.
    expect(moveSegment(route, 1, -100)).toEqual([p(20, 0), p(20, 100)]);
    const backwards = [p(200, 0), p(180, 0), p(180, 100), p(0, 100)];
    expect(moveSegment(backwards, 1, 100)).toEqual([p(180, 0), p(180, 100)]);
  });
});

describe("moveSegment and the stubs", () => {
  it("moveSegment never folds a stub back through its pin", () => {
    // From a right-side pin at (0,0): moving segment 2 up to y = 0 would leave the pin going -x.
    const folding = [p(0, 0), p(20, 0), p(20, 40), p(-60, 40), p(-60, 100), p(-40, 100)];
    expect(moveSegment(folding, 2, -40)).toEqual(folding.slice(1, -1));
    // The same route drawn the other way: now it is the last stub that would fold.
    const back = folding.toReversed();
    expect(moveSegment(back, 2, -40)).toEqual(back.slice(1, -1));
    // A move that keeps both stubs is still allowed.
    expect(moveSegment(folding, 2, 20)).toEqual([p(20, 0), p(20, 60), p(-60, 60), p(-60, 100)]);
  });

  it("moveSegment stops at the last stub's end too", () => {
    const long = [p(0, 0), p(20, 0), p(20, 40), p(80, 40), p(80, 100), p(100, 100)];
    // Segment 3 (x = 80) may come no nearer the pin at x = 100 than one cell.
    expect(moveSegment(long, 3, 60)).toEqual([p(20, 0), p(20, 40), p(80, 40), p(80, 100)]);
    expect(moveSegment(long, 3, -40)).toEqual([p(20, 0), p(20, 40), p(40, 40), p(40, 100)]);
  });

  it("moveSegment merges the collinear points a move leaves", () => {
    const long = [p(0, 0), p(20, 0), p(20, 40), p(60, 40), p(60, 100), p(100, 100)];
    expect(moveSegment(long, 2, -40)).toEqual([p(60, 0), p(60, 100)]);
    // A zero-length first stub leaves a repeated point, dropped too.
    const zeroStub = [p(0, 0), p(0, 0), p(0, 40), p(40, 40)];
    expect(moveSegment(zeroStub, 1, 20)).toEqual([p(20, 0), p(20, 40)]);
    const moved = moveSegment(long, 2, 20);
    expect(moved).toEqual([p(20, 0), p(20, 60), p(60, 60), p(60, 100)]);
  });

  it("moveSegment moves a segment between collinear neighbours with a jog", () => {
    // Segment 2 runs along x between two segments that do too: it gains two corners.
    const flat = [p(0, 0), p(20, 0), p(40, 0), p(60, 0), p(80, 0)];
    const moved = moveSegment(flat, 2, 20);
    expect(orthogonal([p(0, 0), ...moved, p(80, 0)])).toBe(true);
    expect(moved).toEqual([p(40, 0), p(40, 20), p(60, 20), p(60, 0)]);
  });
});

describe("bend mode drags", () => {
  it("a segment drag dispatches one moveWaypoint on release", () => {
    const { context, state, wireId } = bending();
    const [start, move, end] = drag(HANDLE, screen(147, 40));
    const started = gestures(state, context, [start!, move!]);
    expect(started.state.drag).toMatchObject({ kind: "segment", wireId, index: 1, offset: 47 });
    expect(dispatched(started.effects)).toEqual([]);
    const released = gesture(started.state, context, end!);
    expect(dispatched(released.effects)).toEqual([
      {
        type: "moveWaypoint",
        chipId: context.chipId,
        wireId,
        waypoints: [p(140, 20), p(140, 60)],
      },
    ]);
    expect(released.state.drag).toBeUndefined();
    expect(released.state.bends).toEqual({ wireId, segment: 1 });
  });

  it("works in the Pan tool too, and a drag that snaps back edits nothing", () => {
    const { context, state } = bending("pan");
    const result = gestures(state, context, drag(HANDLE, screen(105, 40)));
    expect(result.effects).toEqual([]);
    expect(result.state.drag).toBeUndefined();
  });

  it("Space on a handle pans, and a drag off the handles acts as usual", () => {
    const { context, state } = bending();
    const space = gesture(state, context, drag(HANDLE, HANDLE, { ...NONE, space: true })[0]!);
    expect(space.state.drag?.kind).toBe("pan");
    const body = gesture(state, context, drag(screen(220, 80), screen(240, 80))[0]!);
    expect(body.state.drag?.kind).toBe("move");
  });
});

describe("bend mode handles", () => {
  it("a press between close handles grabs the nearest", () => {
    const { context, state, circuit, wireId } = bending();
    // The route runs (40,20) → (60,20) → (60,40) → (80,40) → (80,60) → (160,60).
    const waypoints = [p(60, 20), p(60, 40), p(80, 40), p(80, 60)];
    const wires = circuit.wires.map((wire) =>
      wire.id === wireId ? { ...wire, waypoints, manualWaypoints: true } : wire,
    );
    const bent = { ...context, scene: { ...context.scene, circuit: { ...circuit, wires } } };
    const [start, move, end] = drag(screen(68, 39), screen(68, 59));
    const started = gestures(state, bent, [start!, move!]).state;
    expect(started.drag).toMatchObject({ kind: "segment", index: 2, axis: "y", offset: 20 });
    expect(dispatched(gesture(started, bent, end!).effects)).toEqual([
      expect.objectContaining({ type: "moveWaypoint", waypoints: [p(60, 20), p(60, 60)] }),
    ]);
  });
});

describe("bend mode drags that edit nothing", () => {
  it("a cancelled segment drag edits nothing", () => {
    const { context, state } = bending();
    const started = gesture(state, context, drag(HANDLE, screen(147, 40))[0]!).state;
    const cancelled = gesture(started, context, { type: "dragCancel" });
    expect(cancelled.state.drag).toBeUndefined();
    expect(cancelled.effects).toEqual([]);
  });

  it("an edit that removes the wire ends its drag and bend mode", () => {
    const { context, state, circuit } = bending();
    const wires = circuit.wires.slice(1);
    const gone = { ...context, scene: { ...context.scene, circuit: { ...circuit, wires } } };
    const started = gesture(state, context, drag(HANDLE, screen(147, 40))[0]!).state;
    const after = interact(started, { type: "historyChanged" }, gone);
    expect(after.state.drag).toBeUndefined();
    expect(after.state.bends).toBeUndefined();
    const ended = gesture(started, gone, { type: "dragEnd", point: screen(147, 40) });
    expect(ended.effects).toEqual([]);
  });

  it("says bend mode is done when an edit removes its wire, as Escape does", () => {
    const { context, state, circuit } = bending();
    const wires = circuit.wires.slice(1);
    const gone = { ...context, scene: { ...context.scene, circuit: { ...circuit, wires } } };
    expect(interact(state, { type: "historyChanged" }, gone).effects).toEqual([
      { type: "announce", announcement: { type: "bends", active: false } },
    ]);
    expect(interact(state, { type: "historyChanged" }, context).effects).toEqual([]);
  });

  it("a wire that is gone has no handles", () => {
    const { context, state, circuit } = bending();
    const wires = circuit.wires.slice(1);
    const gone = { ...context, scene: { ...context.scene, circuit: { ...circuit, wires } } };
    const fresh = gesture(state, gone, drag(HANDLE, HANDLE)[0]!);
    expect(fresh.state.drag?.kind).not.toBe("segment");
    const kept = interact(state, { type: "historyChanged" }, context).state;
    expect(kept.bends).toBe(state.bends);
  });
});

describe("leaving bend mode", () => {
  it("a tap on a handle stays; a tap elsewhere leaves and acts as a tap", () => {
    const { context, state, nand } = bending();
    const kept = gesture(state, context, tap(HANDLE));
    expect(kept.state).toBe(state);
    const left = gesture(state, context, tap(screen(220, 80)));
    expect(left.state.bends).toBeUndefined();
    expect([...left.state.selection.instances]).toEqual([nand.id]);
    expect(left.effects[0]).toEqual(BENDS_DONE);
  });

  it("Escape closes a menu first, then leaves bend mode", () => {
    const { context, state } = bending();
    const menu = { kind: "canvas", screen: screen(0, 0) } as const;
    const closed = command({ ...state, menu }, context, { type: "escape" }).state;
    expect(closed.menu).toBeUndefined();
    expect(closed.bends).toBe(state.bends);
    const left = command(closed, context, { type: "escape" });
    expect(left.state.bends).toBeUndefined();
    expect(left.effects).toEqual([BENDS_DONE]);
  });
});
