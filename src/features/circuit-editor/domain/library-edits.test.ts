import { assert, describe, expect, it } from "vitest";

import { newChip, projectWith } from "~/features/projects";
import type { Project } from "~/features/projects";
import { newChipId, newFolderId } from "~/shared/ids";

import type { EditorAction } from "./actions";
import { customPiece, twoChips } from "./circuit-edits.fixtures";
import { applyAction } from "./reducer";

const base = (): Project => projectWith("p", [newChip("A"), newChip("B")]);

const run = (project: Project, action: EditorAction) => {
  const result = applyAction(project, action);
  assert(result.ok);
  return result.value;
};

const withFolder = () => {
  const folderId = newFolderId();
  const project = run(base(), { type: "createFolder", folderId, name: " Gates " });
  return { project, folderId };
};

describe("createFolder and renameFolder", () => {
  it("createFolder adds a trimmed folder; an empty name and an unknown parent fail", () => {
    const { project, folderId } = withFolder();
    expect(project.folders).toEqual([{ id: folderId, name: "Gates" }]);
    expect(
      applyAction(base(), { type: "createFolder", folderId: newFolderId(), name: " " }),
    ).toEqual({ ok: false, error: { type: "EmptyName" } });
    const missing = newFolderId();
    expect(
      applyAction(base(), {
        type: "createFolder",
        folderId: newFolderId(),
        name: "X",
        parentId: missing,
      }),
    ).toEqual({ ok: false, error: { type: "FolderNotFound", folderId: missing } });
  });

  it("renameFolder renames; an unknown folder fails", () => {
    const { project, folderId } = withFolder();
    expect(run(project, { type: "renameFolder", folderId, name: "Logic" }).folders[0]?.name).toBe(
      "Logic",
    );
    const missing = newFolderId();
    expect(applyAction(project, { type: "renameFolder", folderId: missing, name: "X" })).toEqual({
      ok: false,
      error: { type: "FolderNotFound", folderId: missing },
    });
  });
});

describe("moveFolder and deleteFolder", () => {
  it("moveFolder nests a folder; into itself fails", () => {
    const { project, folderId } = withFolder();
    const innerId = newFolderId();
    const nested = run(project, {
      type: "createFolder",
      folderId: innerId,
      name: "Inner",
      parentId: folderId,
    });
    expect(applyAction(nested, { type: "moveFolder", folderId, parentId: innerId })).toEqual({
      ok: false,
      error: { type: "FolderIntoItself", folderId },
    });
    const moved = run(nested, { type: "moveFolder", folderId: innerId });
    expect(moved.folders.find((folder) => folder.id === innerId)?.parentId).toBeUndefined();
  });

  it("deleteFolder removes it; an unknown folder fails", () => {
    const { project, folderId } = withFolder();
    expect(run(project, { type: "deleteFolder", folderId }).folders).toEqual([]);
    expect(applyAction(base(), { type: "deleteFolder", folderId })).toEqual({
      ok: false,
      error: { type: "FolderNotFound", folderId },
    });
  });
});

describe("fileChip, starChip and tagChip", () => {
  it("fileChip files a chip; an unknown folder fails", () => {
    const { project, folderId } = withFolder();
    const [chip] = project.chips;
    assert(chip !== undefined);
    const filed = run(project, { type: "fileChip", chipId: chip.id, folderId });
    expect(filed.chips[0]?.folderId).toBe(folderId);
    const missing = newFolderId();
    expect(applyAction(project, { type: "fileChip", chipId: chip.id, folderId: missing })).toEqual({
      ok: false,
      error: { type: "FolderNotFound", folderId: missing },
    });
  });

  it("starChip and tagChip edit the chip; an unknown chip fails", () => {
    const project = base();
    const [chip] = project.chips;
    assert(chip !== undefined);
    expect(
      run(project, { type: "starChip", chipId: chip.id, starred: true }).chips[0]?.starred,
    ).toBe(true);
    expect(
      run(project, { type: "tagChip", chipId: chip.id, tags: [" a ", "A", ""] }).chips[0]?.tags,
    ).toEqual(["a"]);
    const chipId = newChipId();
    expect(applyAction(project, { type: "starChip", chipId, starred: true })).toEqual({
      ok: false,
      error: { type: "ChipNotFound", chipId },
    });
    expect(applyAction(project, { type: "tagChip", chipId, tags: [] }).ok).toBe(false);
  });
});

describe("deleteChip", () => {
  it("removes a chip; an unknown chip fails", () => {
    const project = base();
    const [, second] = project.chips;
    assert(second !== undefined);
    expect(run(project, { type: "deleteChip", chipId: second.id }).chips).toHaveLength(1);
    const chipId = newChipId();
    expect(applyAction(project, { type: "deleteChip", chipId })).toEqual({
      ok: false,
      error: { type: "ChipNotFound", chipId },
    });
  });

  it("refuses the last chip", () => {
    const project = base();
    const [first, second] = project.chips;
    assert(first !== undefined && second !== undefined);
    const single = run(project, { type: "deleteChip", chipId: second.id });
    expect(applyAction(single, { type: "deleteChip", chipId: first.id })).toEqual({
      ok: false,
      error: { type: "LastChip" },
    });
  });

  it("refuses a chip another chip places", () => {
    const { project: pair, host, notChip } = twoChips();
    const using = run(pair, {
      type: "placeChip",
      chipId: host.id,
      instance: customPiece(notChip.id),
    });
    expect(applyAction(using, { type: "deleteChip", chipId: notChip.id })).toEqual({
      ok: false,
      error: { type: "ChipInUse", chipId: notChip.id, usedByName: "H" },
    });
  });
});

describe("createChip with a folder", () => {
  it("files the new chip, and fails on an unknown folder", () => {
    const { project, folderId } = withFolder();
    const chipId = newChipId();
    const created = run(project, {
      type: "createChip",
      chipId,
      name: "Mux",
      color: "#aabbcc",
      folderId,
    });
    expect(created.chips.find((chip) => chip.id === chipId)?.folderId).toBe(folderId);
    const missing = newFolderId();
    expect(
      applyAction(project, {
        type: "createChip",
        chipId: newChipId(),
        name: "X",
        color: "#aabbcc",
        folderId: missing,
      }),
    ).toEqual({ ok: false, error: { type: "FolderNotFound", folderId: missing } });
  });
});
