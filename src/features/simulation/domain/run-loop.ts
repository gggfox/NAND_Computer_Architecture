import type { FromEngine } from "./protocol";

export type TimerAction = "start" | "stop" | "keep";

/**
 * What the worker does with its run-loop timer after posting `reply`. Only a `state` reply
 * changes it; an `error` (a rejected message, a failed load) leaves the clock as it was, since
 * the session's run state did not change.
 */
export const nextTimerAction = (reply: FromEngine, hasTimer: boolean): TimerAction => {
  if (reply.type !== "state") {
    return "keep";
  }
  if (reply.running) {
    return hasTimer ? "keep" : "start";
  }
  return hasTimer ? "stop" : "keep";
};
