/* oxlint-disable typescript/prefer-readonly-parameter-types -- projects carry branded ids (mutable object types); none is mutated */
import { describe, expect, it } from "vitest";

import { EMPTY_CIRCUIT, newChip, projectWith } from "~/features/projects";
import type { Chip, Folder } from "~/features/projects";
import { newFolderId } from "~/shared/ids";

import { dragItemOf, dropAction } from "./drop-target";
import type { DragItem, DropTarget } from "./drop-target";
import { BUILTIN_KEY, libraryTree } from "./library-tree";
import type { LibraryNode } from "./library-tree";

const arithmetic: Folder = { id: newFolderId(), name: "Arithmetic" };
const adders: Folder = { id: newFolderId(), name: "Adders", parentId: arithmetic.id };
const logic: Folder = { id: newFolderId(), name: "Logic" };
const main = newChip("Main");
const xor: Chip = { ...newChip("XOR", EMPTY_CIRCUIT, { saved: true }), folderId: logic.id };
const scratch = newChip("Scratch");
const project = { ...projectWith("p", [main, xor, scratch]), folders: [arithmetic, adders, logic] };

const CANVAS: DropTarget = { type: "canvas" };
const TOP_LEVEL: DropTarget = { type: "folder" };
const NONE: DropTarget = { type: "none" };
const into = (folder: Folder): DropTarget => ({ type: "folder", folderId: folder.id });
const folderItem = (folder: Folder): DragItem => ({ type: "folder", folderId: folder.id });
const NAND: DragItem = { type: "part", kind: { type: "nand" } };
const XOR: DragItem = { type: "chip", chipId: xor.id, kind: { type: "custom", chipId: xor.id } };
const SCRATCH: DragItem = { type: "chip", chipId: scratch.id };

const all = (nodes: readonly LibraryNode[]): readonly LibraryNode[] =>
  nodes.flatMap((node) => [
    node,
    ...(node.type === "part" || node.type === "chip" ? [] : all(node.children)),
  ]);
const nodeOf = (key: string): LibraryNode =>
  all(libraryTree(project, main.id)).find((node) => node.key === key) ??
  expect.unreachable(`no node ${key}`);

describe("dropAction", () => {
  it("files a chip dropped on a folder there", () => {
    expect(dropAction(project, XOR, into(arithmetic))).toEqual({
      type: "dispatch",
      action: { type: "fileChip", chipId: xor.id, folderId: arithmetic.id },
    });
  });

  it("files a chip dropped on the top level with no folder", () => {
    expect(dropAction(project, XOR, TOP_LEVEL)).toEqual({
      type: "dispatch",
      action: { type: "fileChip", chipId: xor.id },
    });
  });

  it("refuses a folder dropped into itself or one of its subfolders (Review Focus 1)", () => {
    expect(dropAction(project, folderItem(arithmetic), into(adders))).toEqual({ type: "refuse" });
    expect(dropAction(project, folderItem(arithmetic), into(arithmetic))).toEqual({
      type: "refuse",
    });
  });

  it("moves a folder to another folder or the top level", () => {
    expect(dropAction(project, folderItem(adders), TOP_LEVEL)).toEqual({
      type: "dispatch",
      action: { type: "moveFolder", folderId: adders.id },
    });
    expect(dropAction(project, folderItem(adders), into(logic))).toEqual({
      type: "dispatch",
      action: { type: "moveFolder", folderId: adders.id, parentId: logic.id },
    });
  });

  it("places what can be placed on the canvas and refuses the rest", () => {
    expect(dropAction(project, NAND, CANVAS)).toEqual({ type: "place", kind: { type: "nand" } });
    expect(dropAction(project, XOR, CANVAS)).toEqual({
      type: "place",
      kind: { type: "custom", chipId: xor.id },
    });
    expect(dropAction(project, SCRATCH, CANVAS)).toEqual({ type: "refuse" });
    expect(dropAction(project, folderItem(logic), CANVAS)).toEqual({ type: "refuse" });
  });

  it("refuses a built-in part on a folder, and anything dropped on nothing", () => {
    expect(dropAction(project, NAND, into(logic))).toEqual({ type: "refuse" });
    expect(dropAction(project, NAND, TOP_LEVEL)).toEqual({ type: "refuse" });
    expect(dropAction(project, XOR, NONE)).toEqual({ type: "refuse" });
  });
});

describe("dragItemOf", () => {
  it("drags chips, with their kind only when placeable, folders and parts", () => {
    expect(dragItemOf(nodeOf(`chip:${xor.id}`))).toEqual(XOR);
    expect(dragItemOf(nodeOf(`chip:${scratch.id}`))).toEqual(SCRATCH);
    expect(dragItemOf(nodeOf(`folder:${logic.id}`))).toEqual(folderItem(logic));
    expect(dragItemOf(nodeOf(`${BUILTIN_KEY}:nand`))).toEqual(NAND);
  });

  it("does not drag the built-in group", () => {
    expect(dragItemOf(nodeOf(BUILTIN_KEY))).toBeUndefined();
  });
});
