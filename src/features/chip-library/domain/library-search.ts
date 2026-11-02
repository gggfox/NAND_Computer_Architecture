/* oxlint-disable typescript/prefer-readonly-parameter-types -- nodes carry branded ids (mutable object types); none is mutated */
import type { LibraryNode } from "./library-tree";

/** D8: path (0), name (1), tag (2), colour (3). */
const PATH = 0;
const NAME = 1;
const TAG = 2;
const COLOUR = 3;
export type Tier = typeof PATH | typeof NAME | typeof TAG | typeof COLOUR;

export interface LibraryFilter {
  readonly query: string;
  readonly starred: boolean;
  readonly tags: ReadonlySet<string>;
}

type Leaf = Extract<LibraryNode, { type: "chip" | "part" }>;

export interface Match {
  readonly node: Leaf;
  readonly tier: Tier;
}

/** Case- and diacritic-insensitive form used for all comparisons. */
export const normalize = (text: string): string =>
  text.normalize("NFD").replaceAll(/\p{M}/gu, "").toLowerCase().trim();

export const isFiltering = (filter: LibraryFilter): boolean =>
  normalize(filter.query) !== "" || filter.starred || filter.tags.size > 0;

const compareNames = (left: string, right: string): number =>
  left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });

const leaves = (nodes: readonly LibraryNode[]): readonly Leaf[] =>
  nodes.flatMap((node): readonly Leaf[] =>
    node.type === "chip" || node.type === "part" ? [node] : leaves(node.children),
  );

const passesFilters = (node: Leaf, filter: LibraryFilter): boolean => {
  if (node.type === "part") {
    return !filter.starred && filter.tags.size === 0;
  }
  const own = new Set(node.tags.map(normalize));
  return (
    (!filter.starred || node.starred) && [...filter.tags].every((tag) => own.has(normalize(tag)))
  );
};

const tierOf = (
  node: Leaf,
  query: string,
  colorName: (hex: string) => string | undefined,
): Tier | undefined => {
  const has = (text: string | undefined): boolean =>
    text !== undefined && normalize(text).includes(query);
  if (query === "" || node.type === "part") {
    return query === "" || has(node.name) ? NAME : undefined;
  }
  const candidates: readonly (readonly [Tier, boolean])[] = [
    [PATH, node.path.some(has)],
    [NAME, has(node.name)],
    [TAG, node.tags.some(has)],
    [COLOUR, has(colorName(node.color))],
  ];
  return candidates.find(([, hit]) => hit)?.[0];
};

export const rankMatches = (
  nodes: readonly LibraryNode[],
  filter: LibraryFilter,
  colorName: (hex: string) => string | undefined,
): readonly Match[] => {
  const query = normalize(filter.query);
  const matches = leaves(nodes).flatMap((node): readonly Match[] => {
    const tier = passesFilters(node, filter) ? tierOf(node, query, colorName) : undefined;
    return tier === undefined ? [] : [{ node, tier }];
  });
  return matches.toSorted(
    (left, right) => left.tier - right.tier || compareNames(left.node.name, right.node.name),
  );
};

interface Kept {
  readonly node: LibraryNode;
  readonly tier: number;
}

const nameOf = (node: LibraryNode): string => (node.type === "builtins" ? "" : node.name);

const keep = (node: LibraryNode, tiers: ReadonlyMap<string, Tier>): Kept | undefined => {
  if (node.type === "chip" || node.type === "part") {
    const tier = tiers.get(node.key);
    return tier === undefined ? undefined : { node, tier };
  }
  const children = node.children
    .map((child) => keep(child, tiers))
    .filter((child): child is Kept => child !== undefined)
    .toSorted(
      (left, right) =>
        left.tier - right.tier || compareNames(nameOf(left.node), nameOf(right.node)),
    );
  const [best] = children;
  return best === undefined
    ? undefined
    : { node: { ...node, children: children.map((child) => child.node) }, tier: best.tier };
};

const expandedKeys = (nodes: readonly LibraryNode[]): readonly string[] =>
  nodes.flatMap((node) =>
    node.type === "folder" || node.type === "builtins"
      ? [node.key, ...expandedKeys(node.children)]
      : [],
  );

export const filteredTree = (
  nodes: readonly LibraryNode[],
  matches: readonly Match[],
): { readonly nodes: readonly LibraryNode[]; readonly expanded: ReadonlySet<string> } => {
  const tiers = new Map(matches.map((match) => [match.node.key, match.tier]));
  const kept = nodes
    .map((node) => keep(node, tiers))
    .filter((item): item is Kept => item !== undefined)
    .toSorted(
      (left, right) =>
        left.tier - right.tier || compareNames(nameOf(left.node), nameOf(right.node)),
    )
    .map((item) => item.node);
  return { nodes: kept, expanded: new Set(expandedKeys(kept)) };
};

/** Distinct tags across all chips, sorted; tags equal under `normalize` keep the first spelling (D13). */
export const allTags = (nodes: readonly LibraryNode[]): readonly string[] => {
  const byKey = new Map<string, string>();
  for (const tag of leaves(nodes).flatMap((node) => (node.type === "chip" ? node.tags : []))) {
    if (!byKey.has(normalize(tag))) {
      byKey.set(normalize(tag), tag);
    }
  }
  return [...byKey.values()].toSorted(compareNames);
};
