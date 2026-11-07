import type { PinRef, WireColor } from "~/features/projects";
import type { InstanceId, WireId } from "~/shared/ids";

/** The commands the structure view sends (`interaction-view.ts`). */
export type ViewCommand =
  /** Selects exactly these items; ids that do not exist are dropped. */
  | {
      readonly type: "selectItems";
      readonly instanceIds: readonly InstanceId[];
      readonly wireIds: readonly WireId[];
    }
  /** Wires two pins as one edit; a refusal is announced. */
  | {
      readonly type: "connectPins";
      readonly from: PinRef;
      readonly to: PinRef;
      readonly color?: WireColor;
    };
