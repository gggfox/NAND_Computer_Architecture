/* oxlint-disable eslint/max-lines-per-function, eslint/max-statements, typescript/prefer-readonly-parameter-types -- one describe holds the cases; projects and nodes carry branded ids (mutable object types); none is mutated */
import { describe, expect, it } from "vitest";

import { EMPTY_CIRCUIT, newChip, piece, projectWith } from "~/features/projects";
import type { Chip, Folder, Project } from "~/features/projects";
import { newFolderId } from "~/shared/ids";

import { BUILTIN_KEY, ROOT_KEY, keyOf, libraryTree } from "./library-tree";
import type { LibraryNode, PlaceableKind } from "./library-tree";

const folder = (name: string, parentId?: Folder["parentId"]): Folder => ({
  id: newFolderId(),
  name,
  ...(parentId === undefined ? {} : { parentId }),
});
const saved = (name: string, folderId?: Folder["id"]): Chip => ({
  ...newChip(name, EMPTY_CIRCUIT, { saved: true }),
  ...(folderId === undefined ? {} : { folderId }),
});
const withFolders = (project: Project, folders: readonly Folder[]): Project => ({
  ...project,
  folders,
});
type ChipNode = Extract<LibraryNode, { type: "chip" }>;
const chipNode = (nodes: readonly LibraryNode[], name: string): ChipNode => {
  const found = nodes.flatMap(function walk(node: LibraryNode): LibraryNode[] {
    return node.type === "folder" ? [node, ...node.children.flatMap(walk)] : [node];
  });
  const node = found.find((item) => item.type === "chip" && item.name === name);
  expect(node?.type).toBe("chip");
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the expect above pins the type
  return node as ChipNode;
};

describe("libraryTree", () => {
  it("names the keys the drop zones use", () => {
    const nand: PlaceableKind = { type: "nand" };
    expect(nand.type).toBe("nand");
    expect(ROOT_KEY).toBe("root");
    expect(BUILTIN_KEY).toBe("builtin");
  });

  it("lists the built-ins first, in D7 order", () => {
    const open = saved("Main");
    const [first] = libraryTree(projectWith("p", [open]), open.id);
    expect(first?.type).toBe("builtins");
    const keys = first?.type === "builtins" ? first.children.map((child) => child.key) : [];
    expect(keys).toEqual(
      ["nand", "split-4", "split-8", "split-16", "merge-4", "merge-8", "merge-16"].map(
        (id) => `${BUILTIN_KEY}:${id}`,
      ),
    );
    expect(
      first?.type === "builtins" && first.children.every((child) => child.type === "part"),
    ).toBe(true);
  });

  it("puts subfolders before chips and sorts naturally", () => {
    const zed = folder("Zed");
    const open = saved("Aardvark");
    const project = withFolders(projectWith("p", [open, saved("Adder 10"), saved("Adder 2")]), [
      zed,
    ]);
    const names = libraryTree(project, open.id)
      .slice(1)
      .map((node) => (node.type === "builtins" ? "" : node.name));
    expect(names).toEqual(["Zed", "Aardvark", "Adder 2", "Adder 10"]);
  });

  it("nests folders and gives chips their folder path", () => {
    const arithmetic = folder("Arithmetic");
    const adders = folder("Adders", arithmetic.id);
    const half = saved("Half adder", adders.id);
    const open = saved("Main");
    const project = withFolders(projectWith("p", [open, half]), [adders, arithmetic]);
    const tree = libraryTree(project, open.id);
    expect(chipNode(tree, "Half adder").path).toEqual(["Arithmetic", "Adders"]);
    const [, top] = tree;
    expect(top?.type === "folder" && top.path).toEqual(["Arithmetic"]);
    expect(top?.key).toBe(keyOf.folder(arithmetic.id));
    expect(chipNode(tree, "Half adder").key).toBe(keyOf.chip(half.id));
  });

  it("shows a chip with a missing folder at the top level", () => {
    const open = saved("Main");
    const lost = saved("Lost", newFolderId());
    const orphan = folder("Orphan", newFolderId());
    const project = withFolders(projectWith("p", [open, lost]), [orphan]);
    const tree = libraryTree(project, open.id);
    expect(tree.map((node) => node.key)).toContain(keyOf.chip(lost.id));
    expect(chipNode(tree, "Lost").path).toEqual([]);
    expect(tree.map((node) => node.key)).toContain(keyOf.folder(orphan.id));
  });

  it("marks draft-only chips and refuses the open chip and its containers", () => {
    const open = saved("Open");
    const draft = newChip("Draft");
    const parent: Chip = {
      ...newChip("Parent", {
        ...EMPTY_CIRCUIT,
        instances: [piece({ type: "custom", chipId: open.id })],
      }),
      saved: { ...EMPTY_CIRCUIT, instances: [piece({ type: "custom", chipId: open.id })] },
    };
    const project = projectWith("p", [open, draft, parent, saved("Fine")]);
    const tree = libraryTree(project, open.id);
    const draftNode = chipNode(tree, "Draft");
    expect(draftNode.draftOnly).toBe(true);
    expect(!draftNode.placeable.ok && draftNode.placeable.error.type).toBe("ChipNotSaved");
    const openNode = chipNode(tree, "Open");
    expect(openNode.draftOnly).toBe(false);
    expect(!openNode.placeable.ok && openNode.placeable.error.type).toBe("WouldContainItself");
    const parentNode = chipNode(tree, "Parent");
    expect(!parentNode.placeable.ok && parentNode.placeable.error.type).toBe("WouldContainItself");
    expect(chipNode(tree, "Fine").placeable.ok).toBe(true);
  });

  it("reports ChipNotFound for every chip when the open chip is unknown", () => {
    const only = saved("Only");
    const tree = libraryTree(projectWith("p", [only]), saved("Ghost").id);
    const node = chipNode(tree, "Only");
    expect(!node.placeable.ok && node.placeable.error.type).toBe("ChipNotFound");
  });
});
