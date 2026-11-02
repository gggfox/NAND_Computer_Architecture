import { describe, expect, it } from "vitest";

import { newChipId, newFolderId } from "~/shared/ids";
import { ok } from "~/shared/result";

import type { LibraryNode } from "../domain/library-tree";
import { rowCommands, rowMenuEntries } from "./row-menu";

const chip = (starred: boolean): LibraryNode => ({
  type: "chip",
  key: "chip:x",
  chipId: newChipId(),
  name: "XOR",
  color: "#ef4444",
  starred,
  tags: [],
  path: [],
  draftOnly: false,
  // oxlint-disable-next-line unicorn/no-useless-undefined -- Result<void, _> success carries no value
  placeable: ok(undefined),
});

const folder: LibraryNode = {
  type: "folder",
  key: "folder:x",
  folderId: newFolderId(),
  name: "Logic",
  path: ["Logic"],
  children: [],
};

const part: LibraryNode = {
  type: "part",
  key: "builtin:nand",
  kind: { type: "nand" },
  name: "NAND",
};

describe("rowCommands", () => {
  it("offers Unstar, not Star, on a starred chip", () => {
    const commands = rowCommands(chip(true));
    expect(commands).toContain("unstar");
    expect(commands).not.toContain("star");
  });

  it("lists a chip's commands in menu order", () => {
    expect(rowCommands(chip(false))).toStrictEqual([
      "open",
      "rename",
      "recolor",
      "tags",
      "star",
      "moveTo",
      "delete",
    ]);
  });

  it("lists a folder's commands", () => {
    expect(rowCommands(folder)).toStrictEqual([
      "newFolderInside",
      "renameFolder",
      "moveFolder",
      "deleteFolder",
    ]);
  });

  it("gives built-in parts and the built-ins folder no menu", () => {
    expect(rowCommands(part)).toStrictEqual([]);
    expect(rowCommands({ type: "builtins", key: "builtin", children: [part] })).toStrictEqual([]);
  });
});

describe("rowMenuEntries", () => {
  it("labels each command", () => {
    expect(rowMenuEntries(folder).map((entry) => entry.label)).toStrictEqual([
      "New folder inside…",
      "Rename…",
      "Move to…",
      "Delete",
    ]);
  });
});
