/* oxlint-disable typescript/prefer-readonly-parameter-types -- projects and folders carry branded ids (mutable object types); none is mutated */
import { describe, expect, test } from "vitest";

import { newFolderId } from "~/shared/ids";
import type { FolderId } from "~/shared/ids";
import type { Result } from "~/shared/result";

import { newChip, projectWith } from "./builders";
import {
  createFolder,
  deleteFolder,
  folderPath,
  isWithin,
  moveFolder,
  renameFolder,
} from "./folders";
import type { Folder, Project } from "./model";

const arithmetic: Folder = { id: newFolderId(), name: "Arithmetic" };
const adders: Folder = { id: newFolderId(), name: "Adders", parentId: arithmetic.id };
const logic: Folder = { id: newFolderId(), name: "Logic" };

const buildFixture = (): Project => {
  const seeded = projectWith("p", [
    { ...newChip("Top"), folderId: arithmetic.id },
    { ...newChip("Half adder"), folderId: adders.id },
    { ...newChip("Loose") },
  ]);
  return { ...seeded, folders: [arithmetic, adders, logic] };
};

const top: FolderId | undefined = [logic.id].find(() => false);

const value = <T, E>(result: Result<T, E>): T =>
  result.ok ? result.value : expect.fail("expected an ok result");

const failure = <T, E>(result: Result<T, E>): E =>
  result.ok ? expect.fail("expected an error") : result.error;

const base = buildFixture();

const cycle = (): Project => {
  const first: Folder = { id: newFolderId(), name: "First" };
  const second: Folder = { id: newFolderId(), name: "Second", parentId: first.id };
  return { ...base, folders: [{ ...first, parentId: second.id }, second] };
};

describe("folderPath and isWithin", () => {
  test("folderPath lists the chain root first", () => {
    expect(folderPath(base, adders.id)).toEqual([arithmetic, adders]);
    expect(folderPath(base, arithmetic.id)).toEqual([arithmetic]);
  });

  test("folderPath is empty for the top level and unknown ids", () => {
    expect(folderPath(base, top)).toEqual([]);
    expect(folderPath(base, newFolderId())).toEqual([]);
  });

  test("folderPath ends on a corrupt cycle", () => {
    const cyclic = cycle();
    expect(folderPath(cyclic, cyclic.folders[1]?.id ?? logic.id)).toHaveLength(2);
  });

  test("isWithin is true for self and descendants only", () => {
    const project = base;
    expect(isWithin(project, adders.id, arithmetic.id)).toBe(true);
    expect(isWithin(project, arithmetic.id, adders.id)).toBe(false);
    expect(isWithin(project, logic.id, logic.id)).toBe(true);
    expect(isWithin(project, logic.id, arithmetic.id)).toBe(false);
  });

  test("isWithin ends on a corrupt cycle", () => {
    const cyclic = cycle();
    expect(isWithin(cyclic, cyclic.folders[0]?.id ?? logic.id, logic.id)).toBe(false);
  });
});

describe("createFolder and renameFolder", () => {
  test("createFolder trims the name and appends", () => {
    const id = newFolderId();
    const created = value(createFolder(base, { id, name: "  Memory ", parentId: logic.id }));
    expect(created.folders.at(-1)).toEqual({ id, name: "Memory", parentId: logic.id });
    const atTop = value(createFolder(base, { id, name: "Top" }));
    expect(atTop.folders.at(-1)).toEqual({ id, name: "Top" });
  });

  test("createFolder refuses empty names, duplicate ids and unknown parents", () => {
    const id = newFolderId();
    expect(failure(createFolder(base, { id, name: "   " }))).toEqual({ type: "EmptyName" });
    expect(failure(createFolder(base, { id: logic.id, name: "x" }))).toEqual({
      type: "DuplicateFolder",
      folderId: logic.id,
    });
    const missing = newFolderId();
    expect(failure(createFolder(base, { id, name: "x", parentId: missing }))).toEqual({
      type: "FolderNotFound",
      folderId: missing,
    });
  });

  test("renameFolder trims and validates", () => {
    const renamed = value(renameFolder(base, logic.id, " Gates "));
    expect(renamed.folders.find((folder) => folder.id === logic.id)?.name).toBe("Gates");
    expect(failure(renameFolder(base, logic.id, " "))).toEqual({ type: "EmptyName" });
    const missing = newFolderId();
    expect(failure(renameFolder(base, missing, "x"))).toEqual({
      type: "FolderNotFound",
      folderId: missing,
    });
  });
});

describe("moveFolder", () => {
  test("refuses a move into itself or a subfolder", () => {
    const project = base;
    expect(failure(moveFolder(project, arithmetic.id, adders.id))).toEqual({
      type: "FolderIntoItself",
      folderId: arithmetic.id,
    });
    expect(failure(moveFolder(project, arithmetic.id, arithmetic.id))).toEqual({
      type: "FolderIntoItself",
      folderId: arithmetic.id,
    });
  });

  test("moves to the top level and under another folder", () => {
    const lifted = value(moveFolder(base, adders.id, top));
    expect(lifted.folders.find((folder) => folder.id === adders.id)?.parentId).toBeUndefined();
    const under = value(moveFolder(base, logic.id, arithmetic.id));
    expect(under.folders.find((folder) => folder.id === logic.id)?.parentId).toBe(arithmetic.id);
  });

  test("refuses unknown folders and parents", () => {
    const missing: FolderId = newFolderId();
    expect(failure(moveFolder(base, missing, top))).toEqual({
      type: "FolderNotFound",
      folderId: missing,
    });
    expect(failure(moveFolder(base, logic.id, missing))).toEqual({
      type: "FolderNotFound",
      folderId: missing,
    });
  });
});

describe("deleteFolder", () => {
  test("lifts subfolders and chips to the parent and removes no chip", () => {
    const project = base;
    const result = value(deleteFolder(project, arithmetic.id));
    expect(result.folders.map((folder) => folder.id)).toEqual([adders.id, logic.id]);
    expect(result.folders[0]?.parentId).toBeUndefined();
    expect(result.chips).toHaveLength(project.chips.length);
    expect(result.chips[0]?.folderId).toBeUndefined();
    expect(result.chips[1]?.folderId).toBe(adders.id);
  });

  test("moves a nested folder's contents to its parent", () => {
    const result = value(deleteFolder(base, adders.id));
    expect(result.chips[1]?.folderId).toBe(arithmetic.id);
    expect(result.chips[0]?.folderId).toBe(arithmetic.id);
    expect(result.folders.some((folder) => folder.id === adders.id)).toBe(false);
  });

  test("leaves unrelated folders and refuses unknown ids", () => {
    const missing = newFolderId();
    expect(failure(deleteFolder(base, missing))).toEqual({
      type: "FolderNotFound",
      folderId: missing,
    });
    const result = value(deleteFolder(base, logic.id));
    expect(result.folders[1]).toEqual(adders);
  });
});
