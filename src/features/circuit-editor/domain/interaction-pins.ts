/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Circuit, PinDef } from "~/features/projects";
import type { InstanceId } from "~/shared/ids";

import { worldToScreen } from "./camera";
import { layoutIn } from "./geometry";
import { done, selected, withoutOverlays } from "./interaction";
import type {
  InteractionCommand,
  InteractionContext,
  InteractionState,
  Interpreted,
} from "./interaction";
import { selectInstances } from "./selection";

type Of<Type extends InteractionCommand["type"]> = Extract<InteractionCommand, { type: Type }>;

/** The pin definition behind a pin piece; `undefined` for any other part or a missing one. */
export const pieceDef = (circuit: Circuit, instanceId: InstanceId): PinDef | undefined => {
  const instance = circuit.instances.find((item) => item.id === instanceId);
  const kind = instance?.kind;
  return kind?.type === "pin" ? circuit.pins.find((pin) => pin.id === kind.pinId) : undefined;
};

/**
 * A plain tap on a 1-bit input piece flips its value as well (spec §5.5). A wider input is set in
 * the Pins panel, so a tap only selects it.
 */
export const withToggle = (
  result: Interpreted,
  instanceId: InstanceId,
  context: InteractionContext,
): Interpreted => {
  const def = pieceDef(context.scene.circuit, instanceId);
  if (def?.direction !== "input" || def.width !== 1) {
    return result;
  }
  const value = (context.inputs.get(def.id) ?? 0) === 0 ? 1 : 0;
  return { ...result, effects: [...result.effects, { type: "setInput", pinId: def.id, value }] };
};

/** Opens the rename popover just below a pin piece's name; for any other part, nothing happens. */
export const startRename = (
  state: InteractionState,
  instanceId: InstanceId,
  context: InteractionContext,
): Interpreted => {
  const instance = context.scene.circuit.instances.find((item) => item.id === instanceId);
  const name = instance === undefined ? undefined : layoutIn(context.scene, instance).name;
  if (name === undefined) {
    return done(state);
  }
  const screen = worldToScreen(state.camera, { x: name.x, y: name.y + name.height });
  return done({ ...withoutOverlays(state), renaming: { instanceId, screen } });
};

const endRename = (state: InteractionState): Interpreted => {
  const { renaming: _renaming, ...rest } = state;
  return done(rest);
};

/** The Pins panel's selection: the pieces still in the chip, focused on the first. */
const selectPieces = (
  state: InteractionState,
  command: Of<"selectPieces">,
  context: InteractionContext,
): Interpreted => {
  const present = new Set(context.scene.circuit.instances.map((item) => item.id));
  const instanceIds = command.instanceIds.filter((id) => present.has(id));
  return selected(state, selectInstances(instanceIds), instanceIds[0]);
};

type PinHandlers = {
  readonly [Type in "selectPieces" | "startRename" | "endRename"]: (
    state: InteractionState,
    command: Of<Type>,
    context: InteractionContext,
  ) => Interpreted;
};

/** The pin piece commands, for the command table. */
export const PIN_COMMANDS: PinHandlers = {
  selectPieces,
  startRename: (state, command, context) => startRename(state, command.instanceId, context),
  endRename: (state) => endRename(state),
};
