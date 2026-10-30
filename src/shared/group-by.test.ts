import { expect, test } from "vitest";

import { groupBy } from "./group-by";

test("groups by key in first-seen order, keeping item order", () => {
  const groups = groupBy(["ab", "b", "aa", "c", "ba"], (word) => word.charAt(0));
  expect([...groups]).toEqual([
    ["a", ["ab", "aa"]],
    ["b", ["b", "ba"]],
    ["c", ["c"]],
  ]);
});

test("no items, no groups", () => {
  expect(groupBy([], String).size).toBe(0);
});
