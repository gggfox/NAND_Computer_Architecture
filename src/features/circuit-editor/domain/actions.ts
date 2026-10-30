import type {
  BitWidth,
  ChipInstance,
  ConnectionError,
  InstanceKind,
  PinDef,
  PinRef,
  PlaceError,
  Point,
  SaveError,
} from "~/features/projects";
import type { ChipId, InstanceId, PinId, WireId } from "~/shared/ids";

/** Anything but a chip's own pin piece; those come and go with the Pins panel. */
export type PlaceableInstance = ChipInstance & {
  readonly kind: Exclude<InstanceKind, { readonly type: "pin" }>;
};

export type EditorAction =
  | { readonly type: "placeChip"; readonly chipId: ChipId; readonly instance: PlaceableInstance }
  | {
      readonly type: "moveChip";
      readonly chipId: ChipId;
      readonly instanceId: InstanceId;
      readonly position: Point;
    }
  | { readonly type: "removeChip"; readonly chipId: ChipId; readonly instanceId: InstanceId }
  | {
      readonly type: "connectWire";
      readonly chipId: ChipId;
      readonly wireId: WireId;
      readonly from: PinRef;
      readonly to: PinRef;
    }
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
    }
  | { readonly type: "renameChip"; readonly chipId: ChipId; readonly name: string }
  | { readonly type: "recolorChip"; readonly chipId: ChipId; readonly color: string }
  | { readonly type: "saveChip"; readonly chipId: ChipId }
  | { readonly type: "discardDraft"; readonly chipId: ChipId };

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
  | PlaceError
  | SaveError
  | ConnectionError;
