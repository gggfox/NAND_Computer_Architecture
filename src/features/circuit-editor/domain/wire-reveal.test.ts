import { describe, expect, it } from "vitest";

import { newWireId } from "~/shared/ids";
import type { WireId } from "~/shared/ids";

import { nextReveal, NO_REVEAL, REVEAL_MS, revealDash, revealFraction } from "./wire-reveal";

const [first, second, third] = [newWireId(), newWireId(), newWireId()];

/** One frame of chip `scope` with wires `ids` at `now`; animated unless `animate` is false. */
const tick = (
  scope: string,
  ids: readonly WireId[],
  { now = 0, animate = true }: { readonly now?: number; readonly animate?: boolean } = {},
) => ({ scope, ids, now, animate });

describe("nextReveal", () => {
  it("reveals nothing on the first frame", () => {
    const reveal = nextReveal(NO_REVEAL, tick("chip", [first]));
    expect(reveal.started.size).toBe(0);
    expect(reveal.seen).toStrictEqual(new Set([first]));
  });

  it("reveals a new wire within the same chip, then drops it once revealed", () => {
    const loaded = nextReveal(NO_REVEAL, tick("chip", [first]));
    const added = nextReveal(loaded, tick("chip", [first, second], { now: 10 }));
    expect(added.started).toStrictEqual(new Map([[second, 10]]));
    const midway = nextReveal(added, tick("chip", [first, second], { now: 100 }));
    expect(midway.started).toStrictEqual(new Map([[second, 10]]));
    const done = nextReveal(midway, tick("chip", [first, second], { now: 10 + REVEAL_MS }));
    expect(done.started.size).toBe(0);
  });

  it("reveals the first wire drawn in an empty chip", () => {
    const empty = nextReveal(NO_REVEAL, tick("chip", []));
    expect(nextReveal(empty, tick("chip", [first], { now: 5 })).started.size).toBe(1);
  });

  it("does not reveal a populated chip opened after an empty one", () => {
    const empty = nextReveal(NO_REVEAL, tick("empty", []));
    const opened = nextReveal(empty, tick("full", [first, second], { now: 5 }));
    expect(opened.started.size).toBe(0);
    // Its wires are seen now, so a wire drawn next in it is revealed.
    expect(nextReveal(opened, tick("full", [first, second, third], { now: 6 })).started.size).toBe(
      1,
    );
  });

  it("drops a running reveal when another chip opens", () => {
    const loaded = nextReveal(NO_REVEAL, tick("chip", [first]));
    const added = nextReveal(loaded, tick("chip", [first, second], { now: 5 }));
    expect(nextReveal(added, tick("other", [first, second], { now: 6 })).started.size).toBe(0);
  });

  it("skips the reveal under reduced motion", () => {
    const loaded = nextReveal(NO_REVEAL, tick("chip", [first]));
    const added = nextReveal(loaded, tick("chip", [first, second], { now: 5, animate: false }));
    expect(added.started.size).toBe(0);
  });

  it("drops a removed wire", () => {
    const loaded = nextReveal(NO_REVEAL, tick("chip", [first]));
    const added = nextReveal(loaded, tick("chip", [first, second], { now: 5 }));
    expect(nextReveal(added, tick("chip", [first], { now: 6 })).started.size).toBe(0);
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
