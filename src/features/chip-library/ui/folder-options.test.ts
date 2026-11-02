import { describe, expect, it } from "vitest";

import { EMPTY_CIRCUIT, newChip, projectWith } from "~/features/projects";
import type { Folder, Project } from "~/features/projects";
import { newFolderId } from "~/shared/ids";

import type { LibraryNode } from "../domain/library-tree";
import { currentFolder, folderIdOf, folderOptions, optionOf, TOP_LEVEL } from "./folder-options";

const arithmetic: Folder = { id: newFolderId(), name: "Arithmetic" };
const adders: Folder = { id: newFolderId(), name: "Adders", parentId: arithmetic.id };
const logic: Folder = { id: newFolderId(), name: "Logic" };

const main = { ...newChip("Main", EMPTY_CIRCUIT), folderId: logic.id };
const project: Project = {
  ...projectWith("Library", [main]),
  folders: [logic, adders, arithmetic],
};

const folderNode = (folder: Folder): LibraryNode => ({
  type: "folder",
  key: `folder:${folder.id}`,
  folderId: folder.id,
  name: folder.name,
  path: [folder.name],
  children: [],
});

describe("folderOptions", () => {
  it("offers the top level, then every folder by its path, sorted", () => {
    expect(folderOptions(project).map((option) => option.label)).toStrictEqual([
      "Top level",
      "Arithmetic",
      "Arithmetic › Adders",
      "Logic",
    ]);
  });

  it("leaves out a folder and everything below it", () => {
    expect(folderOptions(project, arithmetic.id).map((option) => option.id)).toStrictEqual([
      TOP_LEVEL,
      logic.id,
    ]);
  });
});

describe("folderIdOf", () => {
  it("reads the top level as no folder and an option as its folder", () => {
    expect(folderIdOf(project, TOP_LEVEL)).toBeUndefined();
    expect(folderIdOf(project, adders.id)).toBe(adders.id);
  });

  it("reads an unknown option as no folder", () => {
    expect(folderIdOf(project, "gone")).toBeUndefined();
  });
});

describe("optionOf", () => {
  it("picks a folder's option, or the top level when it isn't offered", () => {
    const options = folderOptions(project, arithmetic.id);
    expect(optionOf(options, logic.id)).toBe(logic.id);
    expect(optionOf(options, adders.id)).toBe(TOP_LEVEL);
    expect(optionOf(options)).toBe(TOP_LEVEL);
  });
});

describe("currentFolder", () => {
  it("is a chip's folder, a folder's parent, and nothing for a part", () => {
    const chipNode: LibraryNode = {
      type: "chip",
      key: `chip:${main.id}`,
      chipId: main.id,
      name: main.name,
      color: main.color,
      starred: false,
      tags: [],
      path: ["Logic"],
      draftOnly: true,
      placeable: { ok: false, error: { type: "ChipNotSaved", chipId: main.id } },
    };
    expect(currentFolder(project, chipNode)).toBe(logic.id);
    expect(currentFolder(project, folderNode(adders))).toBe(arithmetic.id);
    expect(currentFolder(project, folderNode(logic))).toBeUndefined();
    expect(
      currentFolder(project, {
        type: "part",
        key: "builtin:nand",
        kind: { type: "nand" },
        name: "NAND",
      }),
    ).toBeUndefined();
  });
});
