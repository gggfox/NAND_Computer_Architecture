/* oxlint-disable typescript/prefer-readonly-parameter-types -- nodes carry branded ids (mutable object types); none is mutated */
import { describe, expect, it } from "vitest";

import type { PlaceableKind } from "~/features/circuit-editor";
import { EMPTY_CIRCUIT, newChip, projectWith } from "~/features/projects";
import { newChipId } from "~/shared/ids";

import { BUILTIN_KEY, libraryTree } from "./library-tree";
import type { LibraryNode } from "./library-tree";
import { isArmed, isStalePlacement, kindOfNode, canPlaceRow } from "./placement";

const main = newChip("Main");
const saved = newChip("Saved", EMPTY_CIRCUIT, { saved: true });
const draft = newChip("Draft");
const project = projectWith("p", [main, saved, draft]);
const tree = libraryTree(project, main.id);

const find = (key: string): LibraryNode => {
  const all = (nodes: readonly LibraryNode[]): readonly LibraryNode[] =>
    nodes.flatMap((node) => [
      node,
      ...(node.type === "part" || node.type === "chip" ? [] : all(node.children)),
    ]);
  return all(tree).find((node) => node.key === key) ?? expect.unreachable(`no node ${key}`);
};

const NAND: PlaceableKind = { type: "nand" };
const NOTHING: PlaceableKind | undefined = [NAND].at(1);
const SPLIT_4: PlaceableKind = { type: "split", width: 4 };
const SPLIT_8: PlaceableKind = { type: "split", width: 8 };

describe("placement of library rows", () => {
  it("maps parts and chips to the kind they place, and folders to none", () => {
    expect(kindOfNode(find(`${BUILTIN_KEY}:nand`))).toEqual(NAND);
    expect(kindOfNode(find(`chip:${saved.id}`))).toEqual({ type: "custom", chipId: saved.id });
    expect(kindOfNode(find(BUILTIN_KEY))).toBeUndefined();
  });

  it("reports a chip's whether it can be placed and treats built-ins as always placeable", () => {
    expect(canPlaceRow(find(`${BUILTIN_KEY}:nand`)).ok).toBe(true);
    expect(canPlaceRow(find(`chip:${saved.id}`)).ok).toBe(true);
    expect(canPlaceRow(find(`chip:${draft.id}`))).toEqual({
      ok: false,
      error: { type: "ChipNotSaved", chipId: draft.id },
    });
  });

  it("marks only the row whose kind is armed", () => {
    expect(isArmed(find(`${BUILTIN_KEY}:split-4`), SPLIT_4)).toBe(true);
    expect(isArmed(find(`${BUILTIN_KEY}:split-4`), SPLIT_8)).toBe(false);
    expect(isArmed(find(`${BUILTIN_KEY}:nand`), NAND)).toBe(true);
    expect(isArmed(find(`chip:${saved.id}`), { type: "custom", chipId: saved.id })).toBe(true);
    expect(isArmed(find(`chip:${saved.id}`), NOTHING)).toBe(false);
    expect(isArmed(find(BUILTIN_KEY), NAND)).toBe(false);
  });

  it("finds an armed chip stale once it is deleted or would contain the open chip", () => {
    expect(isStalePlacement(project, main.id, NOTHING)).toBe(false);
    expect(isStalePlacement(project, main.id, NAND)).toBe(false);
    expect(isStalePlacement(project, main.id, { type: "custom", chipId: saved.id })).toBe(false);
    expect(isStalePlacement(project, main.id, { type: "custom", chipId: newChipId() })).toBe(true);
    expect(isStalePlacement(project, saved.id, { type: "custom", chipId: saved.id })).toBe(true);
  });
});
