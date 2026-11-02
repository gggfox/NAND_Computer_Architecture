import { chipSwatches, editorErrorMessage } from "~/features/circuit-editor";
import type { Project } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import type { ChipId } from "~/shared/ids";

import { allTags, filteredTree, isFiltering, rankMatches } from "../domain/library-search";
import type { LibraryFilter } from "../domain/library-search";
import { libraryTree } from "../domain/library-tree";
import type { LibraryNode } from "../domain/library-tree";
import { canPlaceRow } from "../domain/placement";
import { prunedKeys } from "../domain/tree-expansion";

/** A library node as the tree view shows it: with its text, and its children wrapped too. */
export interface LibraryItem {
  readonly key: string;
  readonly textValue: string;
  readonly node: LibraryNode;
  readonly children?: readonly LibraryItem[];
}

const itemOf = (node: LibraryNode): LibraryItem =>
  node.type === "chip" || node.type === "part"
    ? { key: node.key, textValue: node.name, node }
    : {
        key: node.key,
        textValue: node.type === "builtins" ? m.library_builtin() : node.name,
        node,
        children: node.children.map((child) => itemOf(child)),
      };

/** A colour's translated swatch name ("red"), for searching by colour (D8). */
export const colorName = (hex: string): string | undefined =>
  chipSwatches().find((swatch) => swatch.color.toLowerCase() === hex.toLowerCase())?.label;

const NONE: ReadonlySet<string> = new Set();

const without = (keys: ReadonlySet<string>, gone: ReadonlySet<string>): ReadonlySet<string> =>
  new Set([...keys].filter((key) => !gone.has(key)));

/** Folders the user closed while this filter was on; forgotten once the filter changes. */
interface FilterCollapse {
  readonly filter: LibraryFilter;
  readonly keys: ReadonlySet<string>;
}

/** The user's open folders, and those they closed while filtering. */
export interface Expansion {
  readonly open: ReadonlySet<string>;
  readonly collapse: FilterCollapse | undefined;
}

export const NO_EXPANSION: Expansion = { open: new Set(), collapse: undefined };

export interface LibraryView {
  /** Every tag in the project, for the filter chips. */
  readonly tags: readonly string[];
  readonly items: readonly LibraryItem[];
  readonly expanded: ReadonlySet<string>;
  /** Rows that can't be placed, each with why. */
  readonly unavailable: ReadonlyMap<string, string>;
  /** The expansion once the tree shows `keys` open. */
  readonly expand: (keys: ReadonlySet<string>) => Expansion;
}

const unavailableRows = (
  nodes: readonly LibraryNode[],
  into: Map<string, string>,
): Map<string, string> => {
  for (const node of nodes) {
    const placeable = canPlaceRow(node);
    if (!placeable.ok) {
      into.set(node.key, editorErrorMessage(placeable.error));
    }
    if (node.type === "folder" || node.type === "builtins") {
      unavailableRows(node.children, into);
    }
  }
  return into;
};

/**
 * What the tree shows. While filtering: the matches with every folder on their path open (less any
 * the user closed under this filter). Otherwise: the whole tree with the user's open folders.
 */
export const libraryView = (
  source: { readonly project: Project; readonly openChipId: ChipId },
  filter: LibraryFilter,
  state: Expansion,
): LibraryView => {
  const tree = libraryTree(source.project, source.openChipId);
  const tags = allTags(tree);
  if (!isFiltering(filter)) {
    return {
      tags,
      items: tree.map((node) => itemOf(node)),
      expanded: prunedKeys(state.open, tree),
      unavailable: unavailableRows(tree, new Map()),
      expand: (keys) => ({ ...state, open: keys }),
    };
  }
  const shown = filteredTree(tree, rankMatches(tree, filter, colorName));
  const collapsed = state.collapse?.filter === filter ? state.collapse.keys : NONE;
  return {
    tags,
    items: shown.nodes.map((node) => itemOf(node)),
    expanded: without(shown.expanded, collapsed),
    unavailable: unavailableRows(shown.nodes, new Map()),
    expand: (keys) => ({ ...state, collapse: { filter, keys: without(shown.expanded, keys) } }),
  };
};
