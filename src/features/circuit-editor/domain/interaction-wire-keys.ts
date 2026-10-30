import type { InstanceId, WireId } from "~/shared/ids";

import { done, selected } from "./interaction";
import type {
  InteractionCommand,
  InteractionContext,
  InteractionState,
  Interpreted,
} from "./interaction";
import { selectWire } from "./selection";

type NextWire = Extract<InteractionCommand, { type: "nextWire" }>;

/**
 * The chip whose wires `n` steps through: the focused chip (set by `]`, `[` or a tap on a chip),
 * else, with one wire and no chip selected, that wire's source chip.
 */
const anchorOf = (state: InteractionState, context: InteractionContext): InstanceId | undefined => {
  const { instances, wires } = context.scene.circuit;
  if (state.focus !== undefined && instances.some((item) => item.id === state.focus)) {
    return state.focus;
  }
  const [only, ...others] = state.selection.wires;
  const wire =
    others.length === 0 && state.selection.instances.size === 0
      ? wires.find((item) => item.id === only)
      : undefined;
  return wire?.from.instanceId;
};

/** The index of the wire after (or before) the one selected, wrapping; from none, the first or last. */
const stepFrom = (
  state: InteractionState,
  touching: readonly { readonly id: WireId }[],
  backwards: boolean,
): number => {
  const [current, ...rest] = state.selection.wires;
  const at =
    rest.length === 0 && state.selection.instances.size === 0
      ? touching.findIndex((wire) => wire.id === current)
      : -1;
  const count = touching.length;
  if (at === -1) {
    return backwards ? count - 1 : 0;
  }
  return (at + (backwards ? -1 : 1) + count) % count;
};

/**
 * `n` / `Shift`+`N`: selects the next or previous wire touching the anchor chip, in circuit order,
 * wrapping. Each step selects that one wire, replacing the selection, and names its ends.
 */
const nextWire = (
  state: InteractionState,
  command: NextWire,
  context: InteractionContext,
): Interpreted => {
  const anchor = anchorOf(state, context);
  const touching = context.scene.circuit.wires.filter(
    (wire) => wire.from.instanceId === anchor || wire.to.instanceId === anchor,
  );
  const wire = touching[stepFrom(state, touching, command.backwards)];
  if (wire === undefined) {
    return done(state);
  }
  return done(selected(state, selectWire(wire.id)).state, {
    type: "announce",
    announcement: { type: "wireSelected", wireId: wire.id },
  });
};

/** The wire-stepping command, for the command table. */
export const WIRE_KEY_COMMANDS: {
  readonly nextWire: (
    state: InteractionState,
    command: NextWire,
    context: InteractionContext,
  ) => Interpreted;
} = { nextWire };
