import { describe, expect, it } from "vitest";

import { newChip, projectWith } from "~/features/projects";
import { newChipId } from "~/shared/ids";

import { repairTrail, trailInto, trailTo } from "./breadcrumbs";

const one = newChip("a");
const two = newChip("b");
const three = newChip("c");
const project = projectWith("p", [one, two, three]);

describe("trailInto", () => {
  it("appends a chip that is not in the trail", () => {
    expect(trailInto([one.id], two.id)).toEqual([one.id, two.id]);
  });
  it("cuts back to a chip already in the trail", () => {
    expect(trailInto([one.id, two.id, three.id], two.id)).toEqual([one.id, two.id]);
  });
});

describe("trailTo", () => {
  it("keeps the items up to and including the index", () => {
    expect(trailTo([one.id, two.id, three.id], 1)).toEqual([one.id, two.id]);
  });
  it("returns the same trail when the index is out of range", () => {
    const trail = [one.id, two.id];
    expect(trailTo(trail, 2)).toBe(trail);
    expect(trailTo(trail, -1)).toBe(trail);
    expect(trailTo(trail, 0.5)).toBe(trail);
  });
});

describe("repairTrail", () => {
  it("keeps a trail whose chips all exist", () => {
    expect(repairTrail([one.id, two.id], project, two.id)).toEqual([one.id, two.id]);
  });
  it("drops a deleted middle chip", () => {
    expect(repairTrail([one.id, newChipId(), three.id], project, three.id)).toEqual([
      one.id,
      three.id,
    ]);
  });
  it("starts over at the open chip when the trail no longer ends at it", () => {
    expect(repairTrail([one.id, newChipId()], project, two.id)).toEqual([two.id]);
  });
});
