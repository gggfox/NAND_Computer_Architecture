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
    }
  /** Says the current output values once, through the announcement region. */
  | { readonly type: "readOutputs"; readonly readings: readonly OutputReading[] };

/** One output for "Read outputs": its name, and its level (`undefined` when it is not known). */
export interface OutputReading {
  readonly name: string;
  readonly value: number | undefined;
}

/** The announcement of `readOutputs`. */
export interface OutputsAnnouncement {
  readonly type: "outputs";
  readonly readings: readonly OutputReading[];
}
