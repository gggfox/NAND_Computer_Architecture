import type {
  ChipInstance,
  ConnectionError,
  InstanceKind,
  PinRef,
  PlaceError,
  Point,
} from "~/features/projects";
import type { ChipId, InstanceId, WireId } from "~/shared/ids";

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
    };

export type EditorError =
  | { readonly type: "InstanceNotFound"; readonly instanceId: InstanceId }
  | { readonly type: "DuplicateInstance"; readonly instanceId: InstanceId }
  | { readonly type: "WireNotFound"; readonly wireId: WireId }
  | { readonly type: "DuplicateWire"; readonly wireId: WireId }
  | PlaceError
  | ConnectionError;
