import { expect, test } from "vitest";

import type { FromEngine } from "./protocol";
import { nextTimerAction } from "./run-loop";

const state = (running: boolean): FromEngine => ({
  type: "state",
  tick: 0,
  stable: true,
  outputs: [],
  clock: 0,
  running,
});
const BAD_MESSAGE: FromEngine = { type: "error", error: { type: "BadMessage" } };

test.each([
  [state(true), false, "start"],
  [state(true), true, "keep"],
  [state(false), true, "stop"],
  [state(false), false, "keep"],
  [BAD_MESSAGE, true, "keep"],
  [BAD_MESSAGE, false, "keep"],
] as const)("nextTimerAction(%o, hasTimer %s) is %s", (reply, hasTimer, action) => {
  expect(nextTimerAction(reply, hasTimer)).toBe(action);
});

test("an error while running keeps the timer", () => {
  expect(nextTimerAction(BAD_MESSAGE, true)).toBe("keep");
});
