import { partName } from "~/features/circuit-editor";
import type { PlaceableKind } from "~/features/circuit-editor";
import { EMPTY_CIRCUIT } from "~/features/projects";
import type { PinDirection, Project } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import type { ChipId } from "~/shared/ids";
import type { ListSection } from "~/shared/ui";

import { rankMatches } from "../domain/library-search";
import { libraryTree } from "../domain/library-tree";
import type { LibraryNode } from "../domain/library-tree";
import { canPlaceRow, isStalePlacement, kindOfNode } from "../domain/placement";
import { colorName } from "./library-view";

/** How many search matches the quick-add lists. */
export const MATCH_LIMIT = 20;

export type QuickAddPick =
  | { readonly type: "place"; readonly kind: PlaceableKind }
  | { readonly type: "pin"; readonly direction: PinDirection }
  | { readonly type: "tidy" };

export interface QuickAddView {
  readonly sections: readonly ListSection[];
  /** What each entry id does. */
  readonly picks: ReadonlyMap<string, QuickAddPick>;
}

interface Source {
  readonly project: Project;
  readonly openChipId: ChipId;
  /** The last kinds placed this session, newest first. */
  readonly recent: readonly PlaceableKind[];
}

interface Entry {
  readonly key: string;
  readonly label: string;
  readonly pick: QuickAddPick;
}

const NO_TAGS: ReadonlySet<string> = new Set();

const placeable = (nodes: readonly LibraryNode[]): readonly Entry[] =>
  nodes.flatMap((node) => {
    const kind = kindOfNode(node);
    return kind === undefined || node.type === "builtins" || !canPlaceRow(node).ok
      ? []
      : [{ key: node.key, label: node.name, pick: { type: "place", kind } as const }];
  });

const recentEntries = (source: Source): readonly Entry[] =>
  source.recent
    .filter((kind) => !isStalePlacement(source.project, source.openChipId, kind))
    .map((kind, index) => ({
      key: String(index),
      label: partName(source.project, EMPTY_CIRCUIT, kind),
      pick: { type: "place", kind },
    }));

const pinEntries = (): readonly Entry[] => [
  { key: "input", label: m.quick_add_input(), pick: { type: "pin", direction: "input" } },
  { key: "output", label: m.quick_add_output(), pick: { type: "pin", direction: "output" } },
];

const tidyEntries = (): readonly Entry[] => [
  { key: "wires", label: m.canvas_menu_tidy(), pick: { type: "tidy" } },
];

const builtinParts = (tree: readonly LibraryNode[]): readonly LibraryNode[] =>
  tree.flatMap((node) => (node.type === "builtins" ? node.children : []));

const starredChips = (tree: readonly LibraryNode[]): readonly LibraryNode[] =>
  rankMatches(tree, { query: "", starred: true, tags: NO_TAGS }, colorName).map(
    (match) => match.node,
  );

interface Group {
  readonly id: string;
  readonly title?: string | undefined;
  readonly entries: readonly Entry[];
}

const browseGroups = (source: Source, tree: readonly LibraryNode[]): readonly Group[] => [
  { id: "recent", title: m.quick_add_recent(), entries: recentEntries(source) },
  { id: "starred", title: m.quick_add_starred(), entries: placeable(starredChips(tree)) },
  { id: "pins", title: m.quick_add_pins(), entries: pinEntries() },
  { id: "builtin", title: m.quick_add_builtin(), entries: placeable(builtinParts(tree)) },
  { id: "tidy", entries: tidyEntries() },
];

const searchGroups = (tree: readonly LibraryNode[], query: string): readonly Group[] => {
  const matches = rankMatches(tree, { query, starred: false, tags: NO_TAGS }, colorName);
  const entries = placeable(matches.map((match) => match.node)).slice(0, MATCH_LIMIT);
  return [{ id: "matches", entries }];
};

/**
 * The quick-add's lists (D9). Without a query: Recent, Starred, Pins, Built-in and Tidy wires;
 * with one, the ranked matches. Chips that can't be placed in the open chip are left out.
 */
export const quickAddView = (source: Source, query: string): QuickAddView => {
  const tree = libraryTree(source.project, source.openChipId);
  const groups = query.trim() === "" ? browseGroups(source, tree) : searchGroups(tree, query);
  const picks = new Map<string, QuickAddPick>();
  const sections = groups
    .filter((group) => group.entries.length > 0)
    .map(({ id, title, entries }): ListSection => ({
      id,
      title,
      entries: entries.map((entry) => {
        const entryId = `${id}:${entry.key}`;
        picks.set(entryId, entry.pick);
        return { id: entryId, label: entry.label };
      }),
    }));
  return { sections, picks };
};
