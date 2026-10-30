/* oxlint-disable typescript/prefer-readonly-parameter-types -- chips carry branded ids (mutable object types); none is mutated */
import { describe, expect, test } from "vitest";

import { newChipId } from "~/shared/ids";

import { EMPTY_CIRCUIT, newChip, piece, projectWith } from "./builders";
import { chipsUsing, findChip, replaceChip } from "./chips";
import type { Chip } from "./model";

const using = (child: Chip): Chip["draft"] => ({
  pins: [],
  instances: [piece({ type: "custom", chipId: child.id })],
  wires: [],
});

describe("chips", () => {
  test("findChip finds by id and misses unknown ids", () => {
    const chip = newChip("A");
    const project = projectWith("p", [chip, newChip("B")]);
    expect(findChip(project, chip.id)).toBe(chip);
    expect(findChip(project, newChipId())).toBeUndefined();
  });

  test("replaceChip swaps by id and ignores unknown chips", () => {
    const first = newChip("A");
    const second = newChip("B");
    const project = projectWith("p", [first, second]);
    const renamed = { ...second, name: "C" };
    const replaced = replaceChip(project, renamed);
    expect(replaced.chips[0]).toBe(first);
    expect(replaced.chips[1]).toBe(renamed);
    expect(replaceChip(project, newChip("unknown"))).toBe(project);
  });

  test("chipsUsing finds parents through saved versions and drafts", () => {
    const child = newChip("child", undefined, { saved: true });
    // Uses the child only in its saved version: the draft has since dropped it.
    const savedParent = {
      ...newChip("saved parent", using(child), { saved: true }),
      draft: EMPTY_CIRCUIT,
    };
    // Uses the child only in its draft.
    const draftParent = { ...newChip("draft parent", using(child)), saved: EMPTY_CIRCUIT };
    const grandparent = newChip("grandparent", using(savedParent), { saved: true });
    const project = projectWith("p", [
      child,
      savedParent,
      draftParent,
      grandparent,
      newChip("unrelated draft-only chip"),
    ]);
    expect(chipsUsing(project, child.id)).toEqual([savedParent, draftParent]);
  });
});
