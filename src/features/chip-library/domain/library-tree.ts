/* oxlint-disable typescript/prefer-readonly-parameter-types -- projects and nodes carry branded ids (mutable object types); none is mutated */
import { partName } from "~/features/circuit-editor";
import type { PlaceableKind } from "~/features/circuit-editor";
import { EMPTY_CIRCUIT, canPlace, unsavedState } from "~/features/projects";
import type { Folder, PlaceError, Project, UnsavedState } from "~/features/projects";
import { groupBy } from "~/shared/group-by";
import type { ChipId, FolderId } from "~/shared/ids";
import type { Result } from "~/shared/result";

export type { PlaceableKind } from "~/features/circuit-editor";

export const BUILTIN_KEY = "builtin";
export const ROOT_KEY = "root";

export type LibraryNode =
  | {
      readonly type: "builtins";
      readonly key: typeof BUILTIN_KEY;
      readonly children: readonly LibraryNode[];
    }
  | {
      readonly type: "part";
      readonly key: string;
      readonly kind: PlaceableKind;
      readonly name: string;
    }
  | {
      readonly type: "folder";
      readonly key: string;
      readonly folderId: FolderId;
      readonly name: string;
      readonly path: readonly string[];
      readonly children: readonly LibraryNode[];
    }
  | {
      readonly type: "chip";
      readonly key: string;
      readonly chipId: ChipId;
      readonly name: string;
      readonly color: string;
      readonly starred: boolean;
      readonly tags: readonly string[];
      readonly path: readonly string[];
      readonly unsaved: UnsavedState;
      readonly placeable: Result<void, PlaceError>;
    };

export const keyOf = {
  folder: (id: FolderId): string => `folder:${id}`,
  chip: (id: ChipId): string => `chip:${id}`,
};

/** D7: the fixed built-in rows, in order. The clock is not listed until it ships. */
const BUILTIN_KINDS: readonly (readonly [string, PlaceableKind])[] = [
  ["nand", { type: "nand" }],
  ["split-4", { type: "split", width: 4 }],
  ["split-8", { type: "split", width: 8 }],
  ["split-16", { type: "split", width: 16 }],
  ["merge-4", { type: "merge", width: 4 }],
  ["merge-8", { type: "merge", width: 8 }],
  ["merge-16", { type: "merge", width: 16 }],
];

const byName = (left: { readonly name: string }, right: { readonly name: string }): number =>
  left.name.localeCompare(right.name, undefined, { sensitivity: "base", numeric: true });

const builtins = (project: Project): LibraryNode => ({
  type: "builtins",
  key: BUILTIN_KEY,
  children: BUILTIN_KINDS.map(([id, kind]) => ({
    type: "part",
    key: `${BUILTIN_KEY}:${id}`,
    kind,
    name: partName(project, EMPTY_CIRCUIT, kind),
  })),
});

export const libraryTree = (project: Project, openChipId: ChipId): readonly LibraryNode[] => {
  const folderIds = new Set(project.folders.map((folder) => folder.id));
  // A missing parent or folder means the top level, so no chip or folder is ever hidden.
  const topOr = (id: FolderId | undefined): FolderId | undefined =>
    id !== undefined && folderIds.has(id) ? id : undefined;
  const subfolders = groupBy(project.folders, (folder) => topOr(folder.parentId));
  const chipsIn = groupBy(project.chips, (chip) => topOr(chip.folderId));

  const level = (parent: FolderId | undefined, path: readonly string[]): LibraryNode[] => {
    const folders: LibraryNode[] = (subfolders.get(parent) ?? [])
      .toSorted(byName)
      .map((folder: Folder) => {
        const own = [...path, folder.name];
        return {
          type: "folder",
          key: keyOf.folder(folder.id),
          folderId: folder.id,
          name: folder.name,
          path: own,
          children: level(folder.id, own),
        };
      });
    const chips: LibraryNode[] = (chipsIn.get(parent) ?? []).toSorted(byName).map((chip) => ({
      type: "chip",
      key: keyOf.chip(chip.id),
      chipId: chip.id,
      name: chip.name,
      color: chip.color,
      starred: chip.starred,
      tags: chip.tags,
      path,
      unsaved: unsavedState(chip),
      placeable: canPlace(project, openChipId, chip.id),
    }));
    return [...folders, ...chips];
  };

  return [builtins(project), ...level(undefined, [])];
};
