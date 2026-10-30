import { describe, expect, it } from "vitest";

import { createHistory, mapHistory, pushHistory, redo, undo } from "./history";

describe("history", () => {
  it("push 3, undo 2, redo 1 lands on the second state", () => {
    let history = createHistory(0);
    for (const next of [1, 2, 3]) {
      history = pushHistory(history, next);
    }
    const undone = undo(undo(history));
    history = redo(undone);
    expect(history.present).toBe(2);
    expect(history.past).toEqual([0, 1]);
    expect(history.future).toEqual([3]);
  });

  it("pushing after an undo clears the future", () => {
    const pushed = pushHistory(createHistory(0), 1);
    const history = pushHistory(undo(pushed), 5);
    expect(history).toEqual({ past: [0], present: 5, future: [] });
  });

  it("caps past at the given size, dropping the oldest", () => {
    let history = createHistory(0);
    for (let next = 1; next <= 250; next += 1) {
      history = pushHistory(history, next);
    }
    expect(history.past).toHaveLength(200);
    expect(history.past[0]).toBe(50);
    const once = pushHistory(createHistory(0), 1, 1);
    expect(once.past).toEqual([0]);
    expect(pushHistory(once, 2, 1).past).toEqual([1]);
  });

  it("undo and redo past either end are no-ops", () => {
    const history = createHistory("a");
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });

  it("mapHistory maps past, present and future", () => {
    const history = { past: [1], present: 2, future: [3] };
    expect(mapHistory(history, (value) => value * 10)).toEqual({
      past: [10],
      present: 20,
      future: [30],
    });
  });
});
