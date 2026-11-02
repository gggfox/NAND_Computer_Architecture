/* oxlint-disable typescript/prefer-readonly-parameter-types -- projects and nodes carry branded ids (mutable object types); none is mutated */
import type { PlaceableKind } from "~/features/circuit-editor";
import { canPlace } from "~/features/projects";
import type { PlaceError, Project } from "~/features/projects";
import type { ChipId } from "~/shared/ids";
import { ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { LibraryNode } from "./library-tree";

/** What a row places: a built-in's kind or a saved chip; folders place nothing. */
export const kindOfNode = (node: LibraryNode): PlaceableKind | undefined => {
  if (node.type === "part") {
    return node.kind;
  }
  return node.type === "chip" ? { type: "custom", chipId: node.chipId } : undefined;
};

/** Whether a row can be placed now, and why not; built-ins always can. */
export const canPlaceRow = (node: LibraryNode): Result<void, PlaceError> =>
  // oxlint-disable-next-line unicorn/no-useless-undefined -- Result<void, _> success carries no value
  node.type === "chip" ? node.placeable : ok(undefined);

const kindKey = (kind: PlaceableKind): string => {
  if (kind.type === "custom") {
    return `custom:${kind.chipId}`;
  }
  return "width" in kind ? `${kind.type}:${String(kind.width)}` : kind.type;
};

/** Whether `node` is the row whose kind is armed. */
export const isArmed = (node: LibraryNode, placing: PlaceableKind | undefined): boolean => {
  const kind = kindOfNode(node);
  return kind !== undefined && placing !== undefined && kindKey(kind) === kindKey(placing);
};

/**
 * Whether the armed chip can no longer be placed in the open chip: it was deleted, or the open
 * chip changed so that it would contain itself. Built-ins never go stale.
 */
export const isStalePlacement = (
  project: Project,
  openChipId: ChipId,
  placing: PlaceableKind | undefined,
): boolean => placing?.type === "custom" && !canPlace(project, openChipId, placing.chipId).ok;
