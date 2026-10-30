/* oxlint-disable typescript/prefer-readonly-parameter-types -- test fixtures carry branded ids (mutable object types); none is mutated */
import { describe, expect, test } from "vitest";

import { newChipId } from "~/shared/ids";

import { EMPTY_CIRCUIT, newChip, piece, projectWith } from "./builders";
import { canPlace, containsChip } from "./containment";
import type { Chip, Circuit } from "./model";

const using = (...children: readonly Chip[]): Circuit => ({
  pins: [],
  instances: children.map((child) => piece({ type: "custom", chipId: child.id })),
  wires: [],
});

/** C ⊃ B ⊃ A, all saved. */
const chain = () => {
  const leaf = newChip("A", EMPTY_CIRCUIT, { saved: true });
  const middle = newChip("B", using(leaf), { saved: true });
  const top = newChip("C", using(middle), { saved: true });
  return { leaf, middle, top, project: projectWith("p", [leaf, middle, top]) };
};

describe("containsChip", () => {
  test("a chip contains what its saved version places, transitively", () => {
    const { leaf, middle, top, project } = chain();
    expect(containsChip(project, top.id, leaf.id)).toBe(true);
    expect(containsChip(project, top.id, middle.id)).toBe(true);
    expect(containsChip(project, leaf.id, top.id)).toBe(false);
    expect(containsChip(project, leaf.id, leaf.id)).toBe(false);
  });

  test("drafts do not count", () => {
    const top = newChip("C");
    const middle = { ...newChip("B", using(top)), saved: EMPTY_CIRCUIT };
    const project = projectWith("p", [top, middle]);
    expect(containsChip(project, middle.id, top.id)).toBe(false);
  });

  test("a cyclic file terminates", () => {
    const first = newChip("A", EMPTY_CIRCUIT, { saved: true });
    const second = newChip("B", using(first), { saved: true });
    const cyclic = { ...first, saved: using(second), draft: using(second) };
    const unrelated = newChip("Z", EMPTY_CIRCUIT, { saved: true });
    const project = projectWith("p", [cyclic, second, unrelated]);
    expect(containsChip(project, cyclic.id, cyclic.id)).toBe(true);
    expect(containsChip(project, cyclic.id, unrelated.id)).toBe(false);
  });

  test("an instance of a missing chip contains nothing", () => {
    const ghost = newChip("ghost", EMPTY_CIRCUIT, { saved: true });
    const host = newChip("host", using(ghost), { saved: true });
    const project = projectWith("p", [host]);
    expect(containsChip(project, host.id, ghost.id)).toBe(true);
    expect(containsChip(project, host.id, newChipId())).toBe(false);
    expect(containsChip(project, newChipId(), host.id)).toBe(false);
  });
});

describe("canPlace self-containment", () => {
  test("a saved chip can be placed in an unrelated chip", () => {
    const { leaf, project } = chain();
    const host = newChip("host");
    expect(canPlace({ ...project, chips: [...project.chips, host] }, host.id, leaf.id)).toEqual({
      ok: true,
      value: undefined,
    });
  });

  test("a draft-only chip cannot be placed", () => {
    const host = newChip("host");
    const draftOnly = newChip("draft only");
    const project = projectWith("p", [host, draftOnly]);
    expect(canPlace(project, host.id, draftOnly.id)).toEqual({
      ok: false,
      error: { type: "ChipNotSaved", chipId: draftOnly.id },
    });
  });

  test("a chip cannot be placed in itself", () => {
    const { leaf, project } = chain();
    expect(canPlace(project, leaf.id, leaf.id)).toEqual({
      ok: false,
      error: { type: "WouldContainItself", chipId: leaf.id },
    });
  });

  test("nor in a chip it contains indirectly", () => {
    const { leaf, top, project } = chain();
    expect(canPlace(project, leaf.id, top.id)).toEqual({
      ok: false,
      error: { type: "WouldContainItself", chipId: top.id },
    });
    expect(canPlace(project, top.id, leaf.id).ok).toBe(true);
  });

  test("unknown chips are ChipNotFound", () => {
    const { leaf, project } = chain();
    const missing = newChipId();
    expect(canPlace(project, missing, leaf.id)).toEqual({
      ok: false,
      error: { type: "ChipNotFound", chipId: missing },
    });
    expect(canPlace(project, leaf.id, missing)).toEqual({
      ok: false,
      error: { type: "ChipNotFound", chipId: missing },
    });
  });
});
