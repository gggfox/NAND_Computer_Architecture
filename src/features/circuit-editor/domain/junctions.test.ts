/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import type { Point } from "~/features/projects";

import { junctions } from "./junctions";

const p = (x: number, y: number): Point => ({ x, y });

describe("junctions", () => {
  it("two wires of one signal share their trunk and get one junction", () => {
    // Both leave the pin at (0, 0) along the same trunk; one turns up at x = 40.
    const straight = [p(0, 0), p(100, 0)];
    const branch = [p(0, 0), p(40, 0), p(40, -60), p(100, -60)];
    expect(junctions(new Map([["s", [straight, branch]]]))).toStrictEqual([p(40, 0)]);
  });

  it("different signals produce no junction where they cross", () => {
    const across = [p(0, 0), p(100, 0)];
    const down = [p(40, -60), p(40, 60)];
    expect(
      junctions(
        new Map([
          ["a", [across]],
          ["b", [down]],
        ]),
      ),
    ).toStrictEqual([]);
  });

  it("a straight trunk with no split has no junction", () => {
    const first = [p(0, 0), p(100, 0)];
    const second = [p(0, 0), p(60, 0), p(100, 0)];
    expect(junctions(new Map([["s", [first, second]]]))).toStrictEqual([]);
  });
});

describe("junctions, edge cases", () => {
  it("finds a split at a corner of one route on the other's segment, once", () => {
    // Three wires of one signal: two branch at the same point; the dot is listed once.
    const trunk = [p(0, 0), p(100, 0)];
    const up = [p(0, 0), p(40, 0), p(40, -40)];
    const down = [p(0, 0), p(40, 0), p(40, 40)];
    expect(junctions(new Map([["s", [trunk, up, down]]]))).toStrictEqual([p(40, 0)]);
  });

  it("ignores zero-length segments and lone routes", () => {
    const zero = [p(0, 0), p(0, 0), p(40, 0)];
    const other = [p(0, 0), p(40, 0), p(40, 40)];
    expect(junctions(new Map([["s", [zero, other]]]))).toStrictEqual([]);
    const lone = [p(0, 0), p(40, 0), p(40, 40), p(0, 40)];
    expect(junctions(new Map([["s", [lone]]]))).toStrictEqual([]);
  });

  it("treats a diagonal segment as its own direction", () => {
    const first = [p(0, 0), p(40, 0)];
    const second = [p(40, 0), p(80, 40)];
    const third = [p(40, 0), p(40, 40)];
    expect(junctions(new Map([["s", [first, second, third]]]))).toStrictEqual([p(40, 0)]);
  });
});
