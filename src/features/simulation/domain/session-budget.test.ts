import { describe, expect, test } from "vitest";

import { MAX_SETTLE_TICKS, MAX_SETTLE_WORK } from "./protocol";
import { createEngineSession, SETTLE_TICKS } from "./session";

const WORK_BUDGET_EXCEEDED = { type: "error", error: { type: "WorkBudgetExceeded" } };

/** `count` NANDs that all read input 0; every one is stable at once. */
const manyNands = (count: number) => ({
  inputCount: 1,
  nands: Array.from({ length: count }, () => ({
    a: { kind: "input", index: 0 },
    b: { kind: "input", index: 0 },
  })),
  outputs: [{ kind: "nand", index: 0 }],
});

describe("createEngineSession work budget", () => {
  test("a load that cannot settle within the budget is refused and leaves nothing loaded", () => {
    const session = createEngineSession();
    const tooMany = Math.floor(MAX_SETTLE_WORK / SETTLE_TICKS) + 1;
    expect(session.handle({ type: "load", seed: 1, source: manyNands(tooMany) })).toEqual(
      WORK_BUDGET_EXCEEDED,
    );
    expect(session.handle({ type: "step" })).toEqual({
      type: "error",
      error: { type: "BadMessage" },
    });
  });

  test("a load exactly at the budget is accepted", () => {
    const atLimit = Math.floor(MAX_SETTLE_WORK / SETTLE_TICKS);
    expect(
      createEngineSession().handle({ type: "load", seed: 1, source: manyNands(atLimit) }),
    ).toMatchObject({ type: "state", stable: true });
  });

  test("a settle over the budget is refused and the loaded circuit keeps working", () => {
    const session = createEngineSession();
    const nands = Math.floor(MAX_SETTLE_WORK / MAX_SETTLE_TICKS) + 1;
    session.handle({ type: "load", seed: 1, source: manyNands(nands) });
    expect(session.handle({ type: "settle", maxTicks: MAX_SETTLE_TICKS })).toEqual(
      WORK_BUDGET_EXCEEDED,
    );
    expect(
      session.handle({ type: "settle", maxTicks: Math.floor(MAX_SETTLE_WORK / nands) }),
    ).toMatchObject({
      type: "state",
      stable: true,
    });
  });
});
