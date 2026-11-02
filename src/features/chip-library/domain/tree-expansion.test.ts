import { describe, expect, it } from "vitest";

import { EMPTY_CIRCUIT, newChip, projectWith } from "~/features/projects";
import type { Folder } from "~/features/projects";
import { newFolderId } from "~/shared/ids";

import { BUILTIN_KEY, keyOf, libraryTree } from "./library-tree";
import { prunedKeys, toggleKey } from "./tree-expansion";

describe("tree expansion", () => {
  it("toggles a key on and off without mutating", () => {
    const empty: ReadonlySet<string> = new Set();
    const open = toggleKey(empty, "a");
    expect([...open]).toEqual(["a"]);
    expect(empty.size).toBe(0);
    expect(toggleKey(open, "a").size).toBe(0);
  });

  it("prunedKeys drops deleted folders and keeps live ones and the built-ins", () => {
    const outer: Folder = { id: newFolderId(), name: "A" };
    const inner: Folder = { id: newFolderId(), name: "B", parentId: outer.id };
    const chip = newChip("Main", EMPTY_CIRCUIT, { saved: true });
    const tree = libraryTree({ ...projectWith("p", [chip]), folders: [outer, inner] }, chip.id);
    const gone = keyOf.folder(newFolderId());
    const kept = prunedKeys(
      new Set([BUILTIN_KEY, keyOf.folder(outer.id), keyOf.folder(inner.id), gone]),
      tree,
    );
    expect(kept).toEqual(new Set([BUILTIN_KEY, keyOf.folder(outer.id), keyOf.folder(inner.id)]));
  });
});
