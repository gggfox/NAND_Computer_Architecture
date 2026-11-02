/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { interact } from "./interact";
import { previewOf } from "./interaction";
import { drag, gesture, gestures, NONE, screen, setup } from "./interaction.fixtures";
import { selectInstances } from "./selection";

describe("moving chips", () => {
  it("previews without dispatching, then commits one snapped moveChips", () => {
    const { context, state, nand } = setup();
    const [start, move, end] = drag(screen(220, 80), screen(305, 83));
    const moving = gestures(state, context, [start!, move!]);
    expect(moving.effects.filter((effect) => effect.type === "dispatch")).toEqual([]);
    expect(previewOf(moving.state, context.scene)).toEqual(new Map([[nand.id, { x: 240, y: 40 }]]));
    const ended = gesture(moving.state, context, end!);
    expect(ended.state.drag).toBeUndefined();
    expect(ended.effects).toEqual([
      {
        type: "dispatch",
        action: {
          type: "moveChips",
          chipId: context.chipId,
          moves: [{ instanceId: nand.id, position: { x: 240, y: 40 } }],
        },
      },
      { type: "announce", announcement: { type: "moved", count: 1 } },
    ]);
  });

  it("drags the whole selection when it starts on a selected chip", () => {
    const { context, state, nand, pieceA } = setup();
    const both = {
      ...state,
      selection: selectInstances([nand.id, pieceA.id]),
    };
    const result = gestures(both, context, drag(screen(20, 20), screen(60, 20)));
    const dispatched = result.effects.find((effect) => effect.type === "dispatch");
    expect(dispatched).toMatchObject({
      action: { moves: [{ instanceId: pieceA.id }, { instanceId: nand.id }] },
    });
  });
});

describe("moving pin pieces", () => {
  it("snaps a lone pin piece into line, and the preview matches the commit", () => {
    const { context, state, pieceB } = setup();
    const [start, move, end] = drag(screen(20, 100), screen(60, 220));
    const moving = gestures(state, context, [start!, move!]);
    expect(previewOf(moving.state, context.scene)).toEqual(
      new Map([[pieceB.id, { x: 0, y: 200 }]]),
    );
    expect(gesture(moving.state, context, end!).effects[0]).toEqual({
      type: "dispatch",
      action: {
        type: "moveChips",
        chipId: context.chipId,
        moves: [{ instanceId: pieceB.id, position: { x: 0, y: 200 } }],
      },
    });
  });

  it("does not snap a drag of two pin pieces", () => {
    const { context, state, pieceA, pieceB } = setup();
    const both = { ...state, selection: selectInstances([pieceA.id, pieceB.id]) };
    const result = gestures(both, context, drag(screen(20, 20), screen(50, 20)));
    expect(result.effects.find((effect) => effect.type === "dispatch")).toMatchObject({
      action: {
        moves: [
          { instanceId: pieceA.id, position: { x: 40, y: 0 } },
          { instanceId: pieceB.id, position: { x: 40, y: 80 } },
        ],
      },
    });
  });
});

describe("hover while moving", () => {
  it("drops the pin hover when a drag starts, so its ring does not stay behind", () => {
    const { context, state } = setup();
    const hovering = gesture(state, context, { type: "hover", point: screen(220, 80) });
    expect(hovering.state.hover).toBeDefined();
    const [start, move] = drag(screen(220, 80), screen(305, 83));
    expect(gestures(hovering.state, context, [start!, move!]).state.hover).toBeUndefined();
  });
});

describe("moves that do not move", () => {
  it("a drag that snaps back dispatches nothing; a cancel drops the preview", () => {
    const { context, state } = setup();
    const back = drag(screen(220, 80), screen(230, 85));
    const snappedBack = gestures(state, context, back);
    expect(snappedBack.effects.at(-1)).toMatchObject({
      type: "announce",
      announcement: { type: "selected" },
    });
    const [start] = drag(screen(220, 80), screen(400, 80));
    const cancelled = gestures(state, context, [start!, { type: "dragCancel" }]);
    expect(cancelled.state.drag).toBeUndefined();
    expect(cancelled.effects.some((effect) => effect.type === "dispatch")).toBe(false);
  });

  it("moves with any tool, but Space pans instead", () => {
    const pan = setup("pan");
    const across = drag(screen(220, 80), screen(300, 80));
    const moved = gestures(pan.state, pan.context, across);
    expect(moved.effects[1]).toMatchObject({
      type: "dispatch",
    });
    const space = setup();
    const panned = gestures(
      space.state,
      space.context,
      drag(screen(220, 80), screen(300, 80), { ...NONE, space: true }),
    );
    expect(panned.state.camera).toEqual({ zoom: 1, x: -80, y: 0 });
    expect(panned.effects).toEqual([{ type: "cameraSettled" }]);
  });
});

describe("dragging empty canvas", () => {
  it("in the Pan tool pans and settles", () => {
    const { context, state } = setup("pan");
    const result = gestures(state, context, drag(screen(600, 400), screen(560, 380)));
    expect(result.state.camera).toEqual({ zoom: 1, x: 40, y: 20 });
    expect(result.effects).toEqual([{ type: "cameraSettled" }]);
    const [start] = drag(screen(600, 400), screen(560, 380));
    expect(gestures(state, context, [start!, { type: "dragCancel" }]).effects).toEqual([
      { type: "cameraSettled" },
    ]);
  });

  it("in the Select tool box-selects by centre, with the wires between selected chips", () => {
    const { context, state, pieceA, pieceB, nand, circuit } = setup();
    const result = gestures(state, context, drag(screen(-10, -10), screen(225, 130)));
    expect([...result.state.selection.instances]).toEqual([pieceA.id, pieceB.id, nand.id]);
    expect([...result.state.selection.wires]).toEqual([circuit.wires[0]?.id, circuit.wires[1]?.id]);
  });
});

describe("marquee options", () => {
  it("Shift adds to the selection", () => {
    const { context, state, pieceOut, pieceA } = setup();
    const first = gestures(state, context, drag(screen(300, 20), screen(400, 100))).state;
    const added = gestures(
      first,
      context,
      drag(screen(-10, -10), screen(50, 50), { ...NONE, shift: true }),
    );
    expect([...added.state.selection.instances]).toEqual([pieceOut.id, pieceA.id]);
  });

  it("draws a lasso after a long-press, or with Alt", () => {
    const { context, state, pieceA } = setup();
    const lasso = [
      { type: "longPress", point: screen(-20, -20), kind: "touch" },
      {
        type: "dragStart",
        origin: screen(-20, -20),
        point: screen(60, -20),
        kind: "touch",
        modifiers: NONE,
        afterLongPress: true,
      },
      { type: "dragMove", point: screen(60, 60) },
      { type: "dragEnd", point: screen(-20, 60) },
    ] as const;
    const result = gestures(state, context, lasso);
    expect([...result.state.selection.instances]).toEqual([pieceA.id]);
    expect(result.state.lassoArmed).toBe(false);
    const withAlt = gestures(
      state,
      context,
      drag(screen(-20, -20), screen(60, 60), { ...NONE, alt: true }),
    );
    expect(withAlt.state.selection.instances.size).toBe(0);
  });
});

describe("an armed lasso", () => {
  it("a fresh press after a long-press that lifted without dragging draws a box", () => {
    const { context, state } = setup();
    const armed = gesture(state, context, {
      type: "longPress",
      point: screen(600, 400),
      kind: "touch",
    }).state;
    expect(armed.lassoArmed).toBe(true);
    const [start] = drag(screen(600, 400), screen(650, 450));
    const dragging = gesture(armed, context, start!).state;
    expect(dragging.drag).toMatchObject({ kind: "marquee", shape: "box" });
    expect(dragging.lassoArmed).toBe(false);
  });
});

describe("drag events without a drag", () => {
  it("moves and ends without a drag do nothing", () => {
    const { context, state } = setup();
    expect(
      gestures(state, context, [
        { type: "dragMove", point: screen(0, 0) },
        { type: "dragEnd", point: screen(0, 0) },
        { type: "dragCancel" },
      ]),
    ).toEqual({
      state,
      effects: [],
    });
  });
});

describe("unknown inputs", () => {
  it("are rejected by assertNever", () => {
    const { context, state } = setup();
    /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Deliberately violates the exhaustive union to hit assertNever */
    const bogus = JSON.parse('{"kind":"bogus"}') as never;
    const point = screen(0, 0);
    expect(() => gesture({ ...state, drag: bogus }, context, { type: "dragMove", point })).toThrow(
      "Unexpected value",
    );
    expect(() => gesture({ ...state, drag: bogus }, context, { type: "dragEnd", point })).toThrow(
      "Unexpected value",
    );
    /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Deliberately violates the exhaustive union to hit assertNever */
    const unknownInput = JSON.parse('{"type":"bogus"}') as never;
    expect(() => interact(state, unknownInput, context)).toThrow("Unexpected value");
  });
});
