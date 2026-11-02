import { describe, expect, test } from "vitest";

import { newFolderId, newProjectId } from "~/shared/ids";

import { newChip } from "./builders";
import { parseProjectFile } from "./format";

const envelope = (project: unknown): string =>
  JSON.stringify({ format: "nand-project", version: 1, project });

const storedWith = (folders: unknown): string => {
  const { starred: _starred, ...chip } = newChip("Main");
  return envelope({
    id: newProjectId(),
    name: "x",
    seed: 1,
    chips: [chip],
    lastOpenedChipId: chip.id,
    folders,
  });
};

describe("folders and stars", () => {
  test("a stored project without parentId or starred parses", () => {
    const result = parseProjectFile(storedWith([{ id: newFolderId(), name: "Gates" }]));
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.chips[0]?.starred).toBe(false);
    expect(result.ok && result.value.folders[0]?.parentId).toBeUndefined();
  });
  test("a file whose folder parent is missing is rejected", () => {
    const result = parseProjectFile(
      storedWith([{ id: newFolderId(), name: "Gates", parentId: newFolderId() }]),
    );
    expect(!result.ok && result.error.type).toBe("InvalidProject");
    expect(!result.ok && result.error.type === "InvalidProject" && result.error.issues).toEqual([
      expect.stringContaining("folder parent names no folder"),
    ]);
  });
});
