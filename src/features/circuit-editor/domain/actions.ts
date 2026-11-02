import type {
  BitWidth,
  CatalogError,
  ChipInstance,
  ConnectionError,
  FolderError,
  InstanceKind,
  PinDef,
  PinRef,
  PlaceError,
  Point,
  SaveError,
  WireColor,
} from "~/features/projects";
import type { ChipId, FolderId, InstanceId, PinId, WireId } from "~/shared/ids";

import type { Move } from "./move";

/** Anything but a chip's own pin piece; those come and go with the Pins panel. */
export type PlaceableInstance = ChipInstance & {
  readonly kind: Exclude<InstanceKind, { readonly type: "pin" }>;
};

/** What the library places: a built-in part or a saved chip, never a pin piece. */
export type PlaceableKind = PlaceableInstance["kind"];

export type EditorAction =
  | { readonly type: "placeChip"; readonly chipId: ChipId; readonly instance: PlaceableInstance }
  | {
      readonly type: "moveChip";
      readonly chipId: ChipId;
      readonly instanceId: InstanceId;
      readonly position: Point;
    }
  | { readonly type: "removeChip"; readonly chipId: ChipId; readonly instanceId: InstanceId }
  /** Moves several chips as one undo step; wires between two moved chips bring their bends along. */
  | { readonly type: "moveChips"; readonly chipId: ChipId; readonly moves: readonly Move[] }
  /** Deletes a selection as one undo step: the wires, then the chips (with their wires). */
  | {
      readonly type: "removeItems";
      readonly chipId: ChipId;
      readonly instanceIds: readonly InstanceId[];
      readonly wireIds: readonly WireId[];
    }
  | {
      readonly type: "connectWire";
      readonly chipId: ChipId;
      readonly wireId: WireId;
      readonly from: PinRef;
      readonly to: PinRef;
      /** Missing means the default colour. */
      readonly color?: WireColor;
    }
  /** Recolours wires as one undo step; no colour clears it. Routes stay as they are. */
  | {
      readonly type: "recolorWires";
      readonly chipId: ChipId;
      readonly wireIds: readonly WireId[];
      readonly color?: WireColor;
    }
  /** Hands wires back to the router (dropping hand bends) and routes them again. */
  | { readonly type: "rerouteWires"; readonly chipId: ChipId; readonly wireIds: readonly WireId[] }
  | { readonly type: "removeWire"; readonly chipId: ChipId; readonly wireId: WireId }
  | {
      readonly type: "moveWaypoint";
      readonly chipId: ChipId;
      readonly wireId: WireId;
      readonly waypoints: readonly Point[];
    }
  | {
      readonly type: "addPin";
      readonly chipId: ChipId;
      readonly pin: PinDef;
      readonly instanceId: InstanceId;
      readonly position: Point;
    }
  | {
      readonly type: "addPins";
      readonly chipId: ChipId;
      readonly pins: readonly {
        readonly pin: PinDef;
        readonly instanceId: InstanceId;
        readonly position: Point;
      }[];
    }
  | { readonly type: "removePin"; readonly chipId: ChipId; readonly pinId: PinId }
  | {
      readonly type: "renamePin";
      readonly chipId: ChipId;
      readonly pinId: PinId;
      readonly name: string;
    }
  | {
      readonly type: "setPinWidth";
      readonly chipId: ChipId;
      readonly pinId: PinId;
      readonly width: BitWidth;
    }
  | {
      readonly type: "reorderPin";
      readonly chipId: ChipId;
      readonly pinId: PinId;
      readonly toIndex: number;
    }
  | {
      readonly type: "createChip";
      readonly chipId: ChipId;
      readonly name: string;
      readonly color: string;
      /** Missing files the chip at the top level. */
      readonly folderId?: FolderId;
    }
  | { readonly type: "renameChip"; readonly chipId: ChipId; readonly name: string }
  | { readonly type: "recolorChip"; readonly chipId: ChipId; readonly color: string }
  | { readonly type: "saveChip"; readonly chipId: ChipId }
  | { readonly type: "discardDraft"; readonly chipId: ChipId }
  | {
      readonly type: "createFolder";
      readonly folderId: FolderId;
      readonly name: string;
      readonly parentId?: FolderId;
    }
  | { readonly type: "renameFolder"; readonly folderId: FolderId; readonly name: string }
  /** No `parentId` moves the folder to the top level. */
  | { readonly type: "moveFolder"; readonly folderId: FolderId; readonly parentId?: FolderId }
  | { readonly type: "deleteFolder"; readonly folderId: FolderId }
  /** No `folderId` files the chip at the top level. */
  | { readonly type: "fileChip"; readonly chipId: ChipId; readonly folderId?: FolderId }
  | { readonly type: "starChip"; readonly chipId: ChipId; readonly starred: boolean }
  | { readonly type: "tagChip"; readonly chipId: ChipId; readonly tags: readonly string[] }
  /** Resets undo history: a later save could otherwise place a chip deleted in another snapshot. */
  | { readonly type: "deleteChip"; readonly chipId: ChipId };

export type EditorError =
  | { readonly type: "InstanceNotFound"; readonly instanceId: InstanceId }
  | { readonly type: "DuplicateInstance"; readonly instanceId: InstanceId }
  | { readonly type: "WireNotFound"; readonly wireId: WireId }
  | { readonly type: "DuplicateWire"; readonly wireId: WireId }
  | { readonly type: "PinNotFound"; readonly pinId: PinId }
  | { readonly type: "DuplicatePin"; readonly pinId: PinId }
  | { readonly type: "PinIndexOutOfRange"; readonly index: number }
  | { readonly type: "DuplicateChip"; readonly chipId: ChipId }
  | { readonly type: "EmptyName" }
  | { readonly type: "InvalidColor"; readonly color: string }
  | { readonly type: "NothingToMove" }
  | { readonly type: "NothingToRemove" }
  | { readonly type: "NothingToRecolor" }
  | { readonly type: "NothingToReroute" }
  | { readonly type: "NothingToAdd" }
  | PlaceError
  | SaveError
  | ConnectionError
  | FolderError
  | CatalogError;
