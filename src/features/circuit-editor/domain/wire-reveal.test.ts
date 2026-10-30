import { describe, expect, it } from "vitest";

import { newWireId } from "~/shared/ids";

import { nextReveal, NO_REVEAL, REVEAL_MS, revealDash, revealFraction } from "./wire-reveal";

const [first, second, third] = [newWireId(), newWireId(), newWireId()];

describe("nextReveal", () => {
  it("reveals nothing on the first frame", () => {
    const reveal = nextReveal(NO_REVEAL, { ids: [first], now: 0, animate: true });
    expect(reveal.started.size).toBe(0);
    expect(reveal.seen).toStrictEqual(new Set([first]));
  });

  it("starts a new wire, then drops it once revealed", () => {
    const loaded = nextReveal(NO_REVEAL, { ids: [first], now: 0, animate: true });
    const added = nextReveal(loaded, { ids: [first, second], now: 10, animate: true });
    expect(added.started).toStrictEqual(new Map([[second, 10]]));
    const midway = nextReveal(added, { ids: [first, second], now: 100, animate: true });
    expect(midway.started).toStrictEqual(new Map([[second, 10]]));
    const done = nextReveal(midway, { ids: [first, second], now: 10 + REVEAL_MS, animate: true });
    expect(done.started.size).toBe(0);
  });

  it("reveals the first wire of an empty circuit", () => {
    const empty = nextReveal(NO_REVEAL, { ids: [], now: 0, animate: true });
    expect(nextReveal(empty, { ids: [first], now: 5, animate: true }).started.size).toBe(1);
  });

  it("skips the reveal under reduced motion", () => {
    const loaded = nextReveal(NO_REVEAL, { ids: [first], now: 0, animate: true });
    expect(nextReveal(loaded, { ids: [first, second], now: 5, animate: false }).started.size).toBe(
      0,
    );
  });

  it("does not reveal a swapped-in circuit, and drops a removed wire", () => {
    const loaded = nextReveal(NO_REVEAL, { ids: [first], now: 0, animate: true });
    expect(nextReveal(loaded, { ids: [second, third], now: 5, animate: true }).started.size).toBe(
      0,
    );
    const added = nextReveal(loaded, { ids: [first, second], now: 5, animate: true });
    expect(nextReveal(added, { ids: [first], now: 6, animate: true }).started.size).toBe(0);
  });
});

describe("revealFraction", () => {
  it("eases from 0 to 1 over the reveal and clamps outside it", () => {
    expect(revealFraction(100, 50)).toBe(0);
    expect(revealFraction(100, 100)).toBe(0);
    expect(revealFraction(0, REVEAL_MS / 2)).toBeCloseTo(0.875);
    expect(revealFraction(0, REVEAL_MS * 2)).toBe(1);
  });
});

describe("revealDash", () => {
  it("draws a solid wire up to the fraction, then a gap", () => {
    expect(revealDash([], 100, 0.25)).toStrictEqual([25, 100]);
  });

  it("keeps a dashed wire's dashes while it is revealed", () => {
    // [6, 4] up to 15: on 6, off 4, on 5 (cut), then the gap.
    expect(revealDash([6, 4], 100, 0.15)).toStrictEqual([6, 4, 5, 100]);
    // Ending on a gap adds an empty dash before the final gap.
    expect(revealDash([6, 4], 100, 0.1)).toStrictEqual([6, 4, 0, 100]);
  });

  it("shows nothing at the start, and treats an empty period as solid", () => {
    expect(revealDash([6, 4], 100, 0)).toStrictEqual([0, 100]);
    expect(revealDash([0, 0], 100, 0.5)).toStrictEqual([50, 100]);
  });
});
