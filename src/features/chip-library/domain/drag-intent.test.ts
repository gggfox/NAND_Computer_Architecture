/* oxlint-disable eslint/id-length, eslint/max-lines-per-function, eslint/max-statements -- `x` and `y` are coordinate names; one describe holds the cases */
import { describe, expect, it } from "vitest";

import { LONG_PRESS_MS, MOUSE_THRESHOLD, TOUCH_SLOP, stepIntent } from "./drag-intent";
import type { DragIntent, IntentEvent, IntentOutcome } from "./drag-intent";

const run = (events: readonly IntentEvent[]) => {
  let intent: DragIntent = { phase: "idle" };
  let outcome: IntentOutcome = "none";
  for (const event of events) {
    ({ intent, outcome } = stepIntent(intent, event));
  }
  return { intent, outcome };
};

const at0 = { x: 0, y: 0 };
const touchDown: IntentEvent = { type: "down", pointer: "touch", point: at0, at: 0 };
const mouseDown: IntentEvent = { type: "down", pointer: "mouse", point: at0, at: 0 };

describe("stepIntent", () => {
  it("mouse moves 4px → dragging", () => {
    expect(MOUSE_THRESHOLD).toBe(4);
    expect(TOUCH_SLOP).toBe(8);
    expect(run([mouseDown, { type: "move", point: { x: 3, y: 0 }, at: 10 }]).intent.phase).toBe(
      "pressing",
    );
    expect(run([mouseDown, { type: "move", point: { x: 4, y: 0 }, at: 10 }]).intent).toEqual({
      phase: "dragging",
      point: { x: 4, y: 0 },
    });
  });

  it("mouse never long-presses and a still release is a tap", () => {
    expect(run([mouseDown, { type: "tick", at: 900 }]).intent.phase).toBe("pressing");
    expect(run([mouseDown, { type: "up" }]).outcome).toBe("tap");
  });

  it("touch moves 9px before 400ms → scrolling", () => {
    const moved = run([touchDown, { type: "move", point: { x: 0, y: 9 }, at: 100 }]);
    expect(moved.intent.phase).toBe("scrolling");
    expect(
      run([touchDown, { type: "move", point: { x: 0, y: 9 }, at: 100 }, { type: "up" }]).outcome,
    ).toBe("none");
    expect(
      run([
        touchDown,
        { type: "move", point: { x: 0, y: 9 }, at: 100 },
        { type: "move", point: { x: 0, y: 40 }, at: 200 },
      ]).intent.phase,
    ).toBe("scrolling");
  });

  it("touch within the slop stays pressing", () => {
    expect(run([touchDown, { type: "move", point: { x: 0, y: 8 }, at: 100 }]).intent.phase).toBe(
      "pressing",
    );
  });

  it("touch held 400ms then released still → menu", () => {
    const held = run([touchDown, { type: "tick", at: LONG_PRESS_MS }]);
    expect(held.intent.phase).toBe("held");
    expect(run([touchDown, { type: "tick", at: LONG_PRESS_MS }, { type: "up" }]).outcome).toBe(
      "menu",
    );
  });

  it("an early tick changes nothing, and a still wiggle after the hold stays held", () => {
    expect(run([touchDown, { type: "tick", at: 399 }]).intent.phase).toBe("pressing");
    expect(run([{ type: "tick", at: 500 }]).intent.phase).toBe("idle");
    expect(
      run([
        touchDown,
        { type: "tick", at: LONG_PRESS_MS },
        { type: "move", point: { x: 0, y: 5 }, at: 450 },
      ]).intent.phase,
    ).toBe("held");
  });

  it("touch held then moved → dragging; up → drop", () => {
    const events: IntentEvent[] = [
      touchDown,
      { type: "tick", at: LONG_PRESS_MS },
      { type: "move", point: { x: 0, y: 30 }, at: 500 },
    ];
    expect(run(events).intent).toEqual({ phase: "dragging", point: { x: 0, y: 30 } });
    expect(run([...events, { type: "move", point: { x: 0, y: 60 }, at: 520 }]).intent).toEqual({
      phase: "dragging",
      point: { x: 0, y: 60 },
    });
    expect(run([...events, { type: "up" }])).toEqual({
      intent: { phase: "idle" },
      outcome: "drop",
    });
  });

  it("a move after 400ms with no tick yet is a held-then-drag", () => {
    expect(run([touchDown, { type: "move", point: { x: 0, y: 30 }, at: 450 }]).intent.phase).toBe(
      "dragging",
    );
  });

  it("quick touch release → tap", () => {
    expect(run([touchDown, { type: "up" }]).outcome).toBe("tap");
  });

  it("cancel anywhere → idle, none", () => {
    for (const events of [
      [touchDown],
      [touchDown, { type: "tick", at: LONG_PRESS_MS }],
      [touchDown, { type: "move", point: { x: 0, y: 30 }, at: 450 }],
      [touchDown, { type: "move", point: { x: 0, y: 9 }, at: 100 }],
      [],
    ] as const) {
      expect(run([...events, { type: "cancel" }])).toEqual({
        intent: { phase: "idle" },
        outcome: "none",
      });
    }
  });

  it("moves and releases while idle do nothing", () => {
    expect(run([{ type: "move", point: at0, at: 0 }])).toEqual({
      intent: { phase: "idle" },
      outcome: "none",
    });
    expect(run([{ type: "up" }]).outcome).toBe("none");
  });
});
