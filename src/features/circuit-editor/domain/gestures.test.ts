/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { INITIAL_GESTURES, LONG_PRESS_MS } from "./gestures";
import { cancel, down, leave, move, NONE, run, timer, types, up } from "./gestures.fixtures";

describe("tap and drag", () => {
  it("a mouse within 4 px is a tap; beyond is a drag", () => {
    const mouse = { kind: "mouse" } as const;
    expect(types([down(mouse), move({ ...mouse, x: 3 }), up({ ...mouse, x: 3 })])).toEqual(["tap"]);
    expect(
      types([
        down(mouse),
        move({ ...mouse, x: 5 }),
        move({ ...mouse, x: 9 }),
        up({ ...mouse, x: 9 }),
      ]),
    ).toEqual(["dragStart", "dragMove", "dragEnd"]);
  });

  it("touch allows 10 px: a 7 px wobble is still a tap", () => {
    expect(types([down(), move({ x: 7 }), up({ x: 7 })])).toEqual(["tap"]);
    expect(types([down(), move({ x: 11 }), up({ x: 11 })])).toEqual(["dragStart", "dragEnd"]);
  });
});

describe("tap and drag details", () => {
  it("a drag carries its origin, kind and modifiers (Space included)", () => {
    const modifiers = { ...NONE, space: true, shift: true };
    const { gestures } = run([down({ x: 2, y: 3, modifiers }), move({ x: 40, y: 3 })]);
    expect(gestures[0]).toEqual({
      type: "dragStart",
      origin: { x: 2, y: 3 },
      point: { x: 40, y: 3 },
      kind: "touch",
      modifiers,
      afterLongPress: false,
    });
  });

  it("a tap reports where it was released", () => {
    expect(run([down({ x: 1 }), up({ x: 4 })]).gestures).toEqual([
      { type: "tap", point: { x: 4, y: 0 }, kind: "touch", modifiers: NONE },
    ]);
  });

  it("other pointers' moves and lifts do not disturb a mouse press", () => {
    const mouse = { kind: "mouse" } as const;
    expect(
      types([
        down(mouse),
        move({ id: 9, x: 50 }),
        up({ id: 9 }),
        down({ ...mouse, id: 9 }),
        up(mouse),
      ]),
    ).toEqual(["tap"]);
  });
});

describe("long-press", () => {
  it("touch held still asks for a timer and long-presses when it fires", () => {
    const { gestures, timers } = run([down({ time: 100 }), timer(100 + LONG_PRESS_MS)]);
    expect(timers).toEqual([100 + LONG_PRESS_MS]);
    expect(gestures).toEqual([{ type: "longPress", point: { x: 0, y: 0 }, kind: "touch" }]);
  });

  it("an early timer does nothing", () => {
    expect(types([down({ time: 0 }), timer(LONG_PRESS_MS - 1)])).toEqual([]);
  });

  it("after a long-press, the release gives no tap and a move gives a marked drag", () => {
    expect(types([down(), timer(LONG_PRESS_MS), up()])).toEqual(["longPress"]);
    const { gestures } = run([down(), timer(LONG_PRESS_MS), move({ x: 30 })]);
    expect(gestures[1]).toMatchObject({ type: "dragStart", afterLongPress: true });
  });

  it("moving beyond slop first cancels the long-press", () => {
    expect(types([down(), move({ x: 20 }), timer(LONG_PRESS_MS), up({ x: 20 })])).toEqual([
      "dragStart",
      "dragEnd",
    ]);
  });

  it("a mouse never long-presses", () => {
    const mouse = { kind: "mouse" } as const;
    const { gestures, timers } = run([down(mouse), timer(LONG_PRESS_MS), up(mouse)]);
    expect(timers).toEqual([]);
    expect(gestures.map((gesture) => gesture.type)).toEqual(["tap"]);
  });

  it("a pen long-presses like touch", () => {
    expect(types([down({ kind: "pen" }), timer(LONG_PRESS_MS)])).toEqual(["longPress"]);
  });
});

describe("secondary and other buttons", () => {
  it("is an immediate context menu and nothing else from that press", () => {
    const right = { kind: "mouse", button: 2 } as const;
    expect(run([down({ ...right, x: 5 })]).gestures).toEqual([
      { type: "contextMenu", point: { x: 5, y: 0 } },
    ]);
    expect(types([down(right), move({ ...right, x: 50 }), up(right)])).toEqual(["contextMenu"]);
    expect(
      types([
        down(right),
        up({ ...right, id: 7 }),
        up(right),
        down({ kind: "mouse" }),
        up({ kind: "mouse" }),
      ]),
    ).toEqual(["contextMenu", "tap"]);
  });

  it("a middle drag holds Space, so it pans whatever the tool", () => {
    const middle = { kind: "mouse", button: 1 } as const;
    const { gestures } = run([down(middle), move({ ...middle, x: 50 }), up({ ...middle, x: 50 })]);
    expect(gestures.map((gesture) => gesture.type)).toEqual(["dragStart", "dragEnd"]);
    expect(gestures[0]).toMatchObject({ modifiers: { space: true } });
  });

  it("a middle click, back or forward press gives nothing", () => {
    const middle = { kind: "mouse", button: 1 } as const;
    expect(types([down(middle), up(middle)])).toEqual([]);
    expect(types([down({ kind: "mouse", button: 3 }), up({ kind: "mouse" })])).toEqual([]);
  });
});

describe("two fingers", () => {
  it("a second finger before a drag starts a pinch about the midpoint", () => {
    const { gestures } = run([down({ x: 0 }), down({ id: 2, x: 100 })]);
    expect(gestures).toEqual([{ type: "pinchStart", center: { x: 50, y: 0 } }]);
  });

  it("a second finger during a drag ends the drag where the finger is, then pinches", () => {
    const { gestures } = run([down(), move({ x: 30 }), down({ id: 2, x: 130 })]);
    expect(gestures.slice(1)).toEqual([
      { type: "dragEnd", point: { x: 30, y: 0 } },
      { type: "pinchStart", center: { x: 80, y: 0 } },
    ]);
  });
});

describe("pinching", () => {
  it("pinch reports scale and pan since the previous event", () => {
    const { gestures } = run([
      down({ x: 0 }),
      down({ id: 2, x: 100 }),
      move({ id: 2, x: 200 }),
      move({ x: 0, y: 10 }),
    ]);
    expect(gestures[1]).toEqual({
      type: "pinch",
      center: { x: 100, y: 0 },
      scale: 2,
      pan: { x: 50, y: 0 },
    });
    expect(gestures[2]).toMatchObject({ type: "pinch", pan: { x: 0, y: 5 } });
  });

  it("lifting one finger ends the pinch; the other is ignored until lifted", () => {
    expect(
      types([down(), down({ id: 2, x: 100 }), up({ id: 2 }), move({ x: 50 }), up({ x: 50 })]),
    ).toEqual(["pinchStart", "pinchEnd"]);
    const { state } = run([down(), down({ id: 2, x: 100 }), up({ id: 2 }), up({ id: 5 }), up()]);
    expect(state).toEqual(INITIAL_GESTURES);
  });

  it("a third finger is ignored, and its moves and lifts too", () => {
    expect(
      types([
        down(),
        down({ id: 2, x: 100 }),
        down({ id: 3, x: 50 }),
        move({ id: 3, x: 70 }),
        up({ id: 3 }),
      ]),
    ).toEqual(["pinchStart"]);
  });
});

describe("pinch edge cases", () => {
  it("two fingers at the same point do not divide by zero", () => {
    const { gestures } = run([down(), down({ id: 2 }), move({ id: 2, x: 10 })]);
    expect(gestures[1]).toMatchObject({ type: "pinch", scale: 1 });
  });

  it("a mouse cannot add a second pointer", () => {
    expect(types([down(), down({ id: 2, kind: "mouse" })])).toEqual([]);
  });

  it("a finger landing during a context-menu press is ignored", () => {
    expect(types([down({ kind: "mouse", button: 2 }), down({ id: 2 })])).toEqual(["contextMenu"]);
  });
});

describe("cancel", () => {
  it("cancelling a drag is dragCancel; a press, nothing", () => {
    expect(types([down(), move({ x: 20 }), cancel()])).toEqual(["dragStart", "dragCancel"]);
    expect(types([down(), cancel()])).toEqual([]);
    expect(run([down(), cancel()]).state).toEqual(INITIAL_GESTURES);
  });

  it("cancelling a pinch ends it", () => {
    expect(types([down(), down({ id: 2, x: 10 }), cancel({ id: 2 })])).toEqual([
      "pinchStart",
      "pinchEnd",
    ]);
  });
});

describe("hover", () => {
  it("a mouse with no button down hovers; touch never does", () => {
    expect(run([move({ kind: "mouse", x: 3 })]).gestures).toEqual([
      { type: "hover", point: { x: 3, y: 0 } },
    ]);
    expect(types([move()])).toEqual([]);
  });

  it("a hovering mouse leaving ends the hover; touch or a press leaving does nothing", () => {
    expect(types([move({ kind: "mouse" }), leave({ kind: "mouse" })])).toEqual([
      "hover",
      "hoverEnd",
    ]);
    expect(types([leave()])).toEqual([]);
    expect(types([down({ kind: "mouse" }), leave({ kind: "mouse" })])).toEqual([]);
  });

  it("nothing else happens in idle", () => {
    expect(types([up(), cancel(), timer(LONG_PRESS_MS)])).toEqual([]);
  });
});

describe("purity", () => {
  it("the same inputs give the same outputs and the input state is not mutated", () => {
    const inputs = [down(), move({ x: 20 }), down({ id: 2, x: 120 }), move({ id: 2, x: 150 })];
    const start = run(inputs.slice(0, 1)).state;
    const frozen = structuredClone(start);
    const first = run(inputs.slice(1), start);
    const second = run(inputs.slice(1), start);
    expect(first).toEqual(second);
    expect(start).toEqual(frozen);
  });
});
