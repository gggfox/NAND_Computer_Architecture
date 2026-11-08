import { checkConnection } from "~/features/projects";
import type { WireColor } from "~/features/projects";

import { done, selected, withoutOverlays } from "./interaction";
import type {
  InteractionCommand,
  InteractionContext,
  InteractionState,
  Interpreted,
} from "./interaction";
import { selectInstances } from "./selection";

type Of<Type extends InteractionCommand["type"]> = Extract<InteractionCommand, { type: Type }>;

/**
 * Replaces the selection with exactly these items. Ids that are not in the open chip are dropped.
 * The first part takes the focus. Empty lists clear the selection.
 */
const selectItems = (
  state: InteractionState,
  command: Of<"selectItems">,
  context: InteractionContext,
): Interpreted => {
  const { instances, wires } = context.scene.circuit;
  const present = new Set(instances.map((item) => item.id));
  const wired = new Set(wires.map((item) => item.id));
  const instanceIds = command.instanceIds.filter((id) => present.has(id));
  const wireIds = command.wireIds.filter((id) => wired.has(id));
  return selected(
    state,
    { ...selectInstances(instanceIds), wires: new Set(wireIds) },
    instanceIds[0],
  );
};

/** The state with the overlays closed and no old refusal showing. */
const calm = (state: InteractionState): InteractionState => {
  const { notice: _notice, ...rest } = withoutOverlays(state);
  return rest;
};

/**
 * Wires `from` to `to` as one `connectWire`. The canvas check orients the ends. A refusal
 * dispatches nothing and says why. A bus end needs its bit in the pin reference.
 */
const connectPins = (
  state: InteractionState,
  command: Of<"connectPins">,
  context: InteractionContext,
): Interpreted => {
  const { scene } = context;
  const result = checkConnection(scene.project, scene.circuit, command.from, command.to);
  if (!result.ok) {
    return done(
      { ...withoutOverlays(state), notice: result.error },
      { type: "announce", announcement: { type: "refused", reason: result.error } },
    );
  }
  const color: { readonly color?: WireColor } =
    command.color === undefined ? {} : { color: command.color };
  return done(
    calm(state),
    {
      type: "dispatch",
      action: {
        type: "connectWire",
        chipId: context.chipId,
        wireId: context.newWireId(),
        from: result.value.from,
        to: result.value.to,
        ...color,
      },
    },
    {
      type: "announce",
      announcement: { type: "wired", from: result.value.from, to: result.value.to },
    },
  );
};

/** Says all outputs in one announcement. */
const readOutputs = (state: InteractionState, command: Of<"readOutputs">): Interpreted =>
  done(state, {
    type: "announce",
    announcement: { type: "outputs", readings: command.readings },
  });

type ViewHandlers = {
  readonly [Type in "selectItems" | "connectPins" | "readOutputs"]: (
    state: InteractionState,
    command: Of<Type>,
    context: InteractionContext,
  ) => Interpreted;
};

/** The commands the structure view sends, for the wiring command table. */
export const VIEW_COMMANDS: ViewHandlers = { selectItems, connectPins, readOutputs };
