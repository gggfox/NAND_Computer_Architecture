import type { ChipInstance, Point } from "~/features/projects";
import type { InstanceId } from "~/shared/ids";

export type EditorAction =
  | { readonly type: "placeChip"; readonly instance: ChipInstance }
  | { readonly type: "moveChip"; readonly instanceId: InstanceId; readonly position: Point }
  | { readonly type: "removeChip"; readonly instanceId: InstanceId };

export type EditorError =
  | { readonly type: "InstanceNotFound"; readonly instanceId: InstanceId }
  | { readonly type: "DuplicateInstance"; readonly instanceId: InstanceId }
  | { readonly type: "ProtectedInstance"; readonly instanceId: InstanceId };
