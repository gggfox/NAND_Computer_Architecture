// Spanish accents. cspell:ignore sumadór
/* oxlint-disable eslint/max-lines-per-function, typescript/prefer-readonly-parameter-types -- one describe holds the cases; projects and nodes carry branded ids (mutable object types); none is mutated */
import { describe, expect, it } from "vitest";

import { EMPTY_CIRCUIT, newChip, projectWith } from "~/features/projects";
import type { Chip, Folder } from "~/features/projects";
import { newFolderId } from "~/shared/ids";

import { allTags, filteredTree, isFiltering, normalize, rankMatches } from "./library-search";
import type { LibraryFilter, Tier } from "./library-search";
import { BUILTIN_KEY, keyOf, libraryTree } from "./library-tree";
import type { LibraryNode } from "./library-tree";

const noColor = (): undefined => undefined;
const filter = (query: string, extra: Partial<LibraryFilter> = {}): LibraryFilter => ({
  query,
  starred: false,
  tags: new Set(),
  ...extra,
});
const chip = (name: string, extra: Partial<Chip> = {}): Chip => ({
  ...newChip(name, EMPTY_CIRCUIT, { saved: true }),
  ...extra,
});

const arithmetic: Folder = { id: newFolderId(), name: "Arithmetic" };
const adders: Folder = { id: newFolderId(), name: "Adders", parentId: arithmetic.id };
const half = chip("Half adder", { folderId: adders.id, tags: ["adder"] });
const full = chip("Full adder", { folderId: adders.id, tags: ["adder", "gate"] });
const gate = chip("And gate", { tags: ["gate"], starred: true });
const tagged = chip("Other", { tags: ["half"] });
const red = chip("Painted", { color: "#ef4444" });
const main = chip("Main");
const project = {
  ...projectWith("p", [main, half, full, gate, tagged, red]),
  folders: [arithmetic, adders],
};
const tree = libraryTree(project, main.id);
type Matches = ReturnType<typeof rankMatches>;
const names = (matches: Matches) => matches.map((match) => match.node.name);
const summary = (matches: Matches) =>
  matches.map((match): readonly [string, Tier] => [match.node.name, match.tier]);
const rank = (query: string, extra: Partial<LibraryFilter> = {}) =>
  rankMatches(tree, filter(query, extra), noColor);
const redName = (hex: string) => (hex === "#ef4444" ? "Red" : undefined);
const gateOnly: ReadonlySet<string> = new Set(["gate"]);
const gateAndAdder: ReadonlySet<string> = new Set(["gate", "adder"]);

describe("normalize", () => {
  it("lower-cases, strips diacritics and trims", () => {
    expect(normalize("  SumadÓr ")).toBe("sumador");
  });
});

describe("rankMatches", () => {
  it("matches every chip under a folder by path at tier 0", () => {
    const matches = rankMatches(tree, filter("adders"), noColor);
    expect(summary(matches)).toEqual([
      ["Full adder", 0],
      ["Half adder", 0],
    ]);
  });

  it("ranks name above tag, and a path-and-name match at tier 0", () => {
    const matches = rankMatches(tree, filter("half"), noColor);
    expect(summary(matches)).toEqual([
      ["Half adder", 1],
      ["Other", 2],
    ]);
    const both = rankMatches(tree, filter("adder"), noColor);
    expect(both.find((match) => match.node.name === "Half adder")?.tier).toBe(0);
  });

  it("matches the colour name at tier 3", () => {
    const matches = rankMatches(tree, filter("red"), redName);
    expect(summary(matches)).toEqual([["Painted", 3]]);
  });

  it("ignores case and diacritics in Spanish names", () => {
    const sumador = chip("Sumador");
    const es = libraryTree({ ...projectWith("p", [main, sumador]), folders: [] }, main.id);
    for (const query of ["SUMADOR", "sumador", "sumadór"]) {
      const found = rankMatches(es, filter(query), noColor);
      expect(names(found)).toEqual(["Sumador"]);
    }
  });

  it("matches parts on name only and drops them under star and tag filters", () => {
    expect(names(rank("nand"))).toContain("NAND");
    const starred = rank("", { starred: true }).map((match) => match.node.type);
    expect(starred).toEqual(["chip"]);
    expect(names(rank("", { tags: gateOnly }))).not.toContain("NAND");
  });

  it("gives every passing chip tier 1 on an empty query", () => {
    const matches = rankMatches(tree, filter("", { starred: true }), noColor);
    expect(summary(matches)).toEqual([["And gate", 1]]);
  });

  it("requires every tag in the tag filter", () => {
    const both = rankMatches(tree, filter("", { tags: gateAndAdder }), noColor);
    expect(names(both)).toEqual(["Full adder"]);
  });

  it("drops chips that match nothing", () => {
    expect(rankMatches(tree, filter("zzz"), noColor)).toEqual([]);
  });
});

describe("filteredTree", () => {
  it("keeps the folders leading to matches and expands them", () => {
    const result = filteredTree(tree, rankMatches(tree, filter("adders"), noColor));
    expect(result.expanded).toEqual(
      new Set([keyOf.folder(arithmetic.id), keyOf.folder(adders.id)]),
    );
    expect(result.nodes.map((node) => node.key)).toEqual([keyOf.folder(arithmetic.id)]);
  });

  it("orders siblings by best tier then name and keeps matching built-ins", () => {
    const matches = rankMatches(tree, filter("half"), noColor);
    const result = filteredTree(tree, matches);
    expect(result.nodes.map((node) => node.key)).toEqual([
      keyOf.folder(arithmetic.id),
      keyOf.chip(tagged.id),
    ]);
    const parts = filteredTree(tree, rankMatches(tree, filter("split"), noColor));
    const first: LibraryNode | undefined = parts.nodes[0];
    expect(first?.key).toBe(BUILTIN_KEY);
    expect(parts.expanded.has(BUILTIN_KEY)).toBe(true);
  });

  it("orders mixed siblings: tier 0 first, then by name", () => {
    const all = filteredTree(tree, rankMatches(tree, filter(""), noColor));
    const topNames = all.nodes.map((node) => (node.type === "builtins" ? "" : node.name));
    expect(topNames).toEqual(["", "And gate", "Arithmetic", "Main", "Other", "Painted"]);
  });
});

describe("isFiltering and allTags", () => {
  it("is false for an empty query with no filters, true otherwise", () => {
    expect(isFiltering(filter(" "))).toBe(false);
    expect(isFiltering(filter("x"))).toBe(true);
    expect(isFiltering(filter("", { starred: true }))).toBe(true);
    expect(isFiltering(filter("", { tags: gateOnly }))).toBe(true);
  });

  it("lists distinct tags sorted", () => {
    expect(allTags(tree)).toEqual(["adder", "gate", "half"]);
  });
});
