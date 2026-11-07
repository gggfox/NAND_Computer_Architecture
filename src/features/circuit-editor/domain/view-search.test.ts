/* oxlint-disable eslint/id-length -- `x` and `y` are the public URL search param names */
import { describe, expect, test } from "vitest";

import { newChip, projectWith } from "~/features/projects";
import { newChipId } from "~/shared/ids";

import { EditorSearchSchema, startingChipId } from "./view-search";

describe("EditorSearchSchema", () => {
  test("defaults", () => {
    expect(EditorSearchSchema.parse({})).toEqual({ zoom: 1, x: 0, y: 0 });
  });
  test("garbage falls back", () => {
    expect(EditorSearchSchema.parse({ zoom: "abc", x: "NaN", chip: "nope" })).toEqual({
      zoom: 1,
      x: 0,
      y: 0,
    });
  });
  test("numeric NaN and infinities in x and y fall back to 0", () => {
    const values = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
    expect(values.map((value) => EditorSearchSchema.parse({ x: value, y: value }))).toEqual(
      values.map(() => ({ zoom: 1, x: 0, y: 0 })),
    );
  });
  test("out-of-range zoom falls back", () => {
    expect(EditorSearchSchema.parse({ zoom: 999 }).zoom).toBe(1);
  });
  test("valid values kept", () => {
    const chip = newChipId();
    expect(EditorSearchSchema.parse({ chip, zoom: 2 })).toMatchObject({ chip, zoom: 2 });
  });
});

describe("startingChipId", () => {
  const first = newChip("a");
  const second = newChip("b");
  const project = { ...projectWith("p", [first, second]), lastOpenedChipId: first.id };

  test("a chip the project has is opened", () => {
    expect(startingChipId(project, second.id)).toBe(second.id);
  });
  test("an unknown chip falls back to the last opened one", () => {
    expect(startingChipId(project, newChipId())).toBe(first.id);
  });
  test("no chip falls back to the last opened one", () => {
    // oxlint-disable-next-line unicorn/no-useless-undefined -- the absent search param is the case under test
    expect(startingChipId(project, undefined)).toBe(first.id);
  });
});
