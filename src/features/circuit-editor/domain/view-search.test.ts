/* oxlint-disable eslint/id-length -- `x` and `y` are the public URL search param names */
import { describe, expect, test } from "vitest";

import { newChipId } from "~/shared/ids";

import { EditorSearchSchema } from "./view-search";

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
  test("out-of-range zoom falls back", () => {
    expect(EditorSearchSchema.parse({ zoom: 999 }).zoom).toBe(1);
  });
  test("valid values kept", () => {
    const chip = newChipId();
    expect(EditorSearchSchema.parse({ chip, zoom: 2 })).toMatchObject({ chip, zoom: 2 });
  });
});
