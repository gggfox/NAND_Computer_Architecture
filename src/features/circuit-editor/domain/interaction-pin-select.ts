import type { PinRef } from "~/features/projects";

import { planBulkWires } from "./bulk-wiring";
import { done } from "./interaction";
import type {
  Announcement,
  InteractionContext,
  InteractionState,
  Interpreted,
} from "./interaction";
import type { PinCommand } from "./selection";
import { appendPins, samePinOn, togglePinIn, withPins } from "./selection";

/** "On all selected chips" needs a second chip to be more than the one pin. */
const MIN_CHIPS = 2;

const announce = (announcement: Announcement) => ({ type: "announce", announcement }) as const;

const pinsSelected = (count: number) => announce({ type: "pinsSelected", count });

/** The state with its pin list replaced; nothing armed, so a picked pin never completes a wire. */
const withPinList = (state: InteractionState, pins: readonly PinRef[]): InteractionState => {
  const { armed: _armed, bitPick: _bitPick, ...rest } = state;
  return { ...rest, selection: withPins(state.selection, pins) };
};

/**
 * A plain tap or Enter on `source` with pins selected: wires them all as one undo step, or
 * refuses and keeps the pins so the offending one can be fixed (D4–D8).
 */
export const wireSelectedPins = (
  state: InteractionState,
  source: PinRef,
  context: InteractionContext,
): Interpreted => {
  const { pins } = state.selection;
  const plan = planBulkWires(context.scene, { source, pins });
  if (!plan.ok) {
    return done(
      { ...state, notice: plan.error },
      announce({ type: "bulkRefused", refusal: plan.error }),
    );
  }
  const { wires, shape } = plan.value;
  if (wires.length === 0) {
    return done(state);
  }
  const { pinPick: _pinPick, ...rest } = withPinList(state, []);
  const color = state.wireColor === undefined ? {} : { color: state.wireColor };
  return done(
    rest,
    {
      type: "dispatch",
      action: {
        type: "connectWires",
        chipId: context.chipId,
        wires: wires.map((item) => ({ wireId: context.newWireId(), ...item })),
        ...color,
      },
    },
    announce({
      type: "bulkWired",
      count: wires.length,
      source,
      ...(shape.type === "bits" ? { bits: { first: shape.first, last: shape.last } } : {}),
    }),
  );
};

/** Shift+tap, or a tap while picking: adds the pin to the list, or removes it (D2). */
export const togglePickedPin = (state: InteractionState, pin: PinRef): Interpreted => {
  const pins = togglePinIn(state.selection.pins, pin);
  return done(withPinList(state, pins), pinsSelected(pins.length));
};

/** Escape's pin step: the pin list and Pick pins go; `undefined` when neither is on (D10). */
export const clearPins = (state: InteractionState): Interpreted | undefined => {
  if (state.selection.pins.length === 0 && state.pinPick === undefined) {
    return undefined;
  }
  const { pinPick: _pinPick, ...rest } = withPinList(state, []);
  return done(rest, pinsSelected(0));
};

/** `Shift`+`Space`: adds or removes the pin in the card. */
const togglePin = (state: InteractionState): Interpreted =>
  state.card === undefined
    ? done(state)
    : togglePickedPin(state, { instanceId: state.card.instanceId, pin: state.card.pin });

/** `a`: the card's pin on every selected chip of its kind, in reading order (D3). */
const selectPinOnAll = (state: InteractionState, context: InteractionContext): Interpreted => {
  const { card, selection } = state;
  if (
    card === undefined ||
    selection.instances.size < MIN_CHIPS ||
    !selection.instances.has(card.instanceId)
  ) {
    return done(state);
  }
  const like = { instanceId: card.instanceId, pin: card.pin };
  const more = samePinOn(context.scene, { like, instanceIds: selection.instances });
  const pins = appendPins(selection.pins, more);
  return done(withPinList(state, pins), pinsSelected(pins.length));
};

/** The Pick pins toggle: while on, a plain tap on a pin picks it (D9). */
const togglePinPick = (state: InteractionState): Interpreted => {
  const { pinPick: _pinPick, ...rest } = state;
  return done(state.pinPick === undefined ? { ...rest, pinPick: true } : rest);
};

type PinSelectHandlers = Record<
  PinCommand["type"],
  (state: InteractionState, command: PinCommand, context: InteractionContext) => Interpreted
>;

/** The pin-selection commands, for the wiring command table. */
export const PIN_SELECT_COMMANDS: PinSelectHandlers = {
  togglePin: (state) => togglePin(state),
  selectPinOnAll: (state, _command, context) => selectPinOnAll(state, context),
  togglePinPick: (state) => togglePinPick(state),
};
