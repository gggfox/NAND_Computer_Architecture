/* oxlint-disable typescript/prefer-readonly-parameter-types -- nodes carry branded ids (mutable object types); none is mutated */
import type { LibraryNode } from "./library-tree";

export const toggleKey = (expanded: ReadonlySet<string>, key: string): ReadonlySet<string> => {
  const next = new Set(expanded);
  if (!next.delete(key)) {
    next.add(key);
  }
  return next;
};

const folderKeys = (nodes: readonly LibraryNode[], into: Set<string>): void => {
  for (const node of nodes) {
    if (node.type === "folder") {
      into.add(node.key);
      folderKeys(node.children, into);
    }
  }
};

/** Drops the keys of folders that no longer exist; keeps the built-ins key. */
export const prunedKeys = (
  expanded: ReadonlySet<string>,
  nodes: readonly LibraryNode[],
): ReadonlySet<string> => {
  const live = new Set<string>();
  folderKeys(nodes, live);
  return new Set(
    [...expanded].filter((key) => live.has(key) || nodes.some((node) => node.key === key)),
  );
};
