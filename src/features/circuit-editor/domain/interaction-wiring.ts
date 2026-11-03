import type { ConnectionError, PinRef, Point, WireColor } from "~/features/projects";

import { worldToScreen } from "./camera";
import { layoutIn } from "./geometry";
import type { Hit } from "./hit-test";
import { done, withoutOverlays } from "./interaction";
import type {
  Armed,
  Effect,
  InteractionCommand,
  InteractionContext,
  InteractionState,
  Interpreted,
} from "./interaction";
import {
  clearPins,
  PIN_SELECT_COMMANDS,
  togglePickedPin,
  wireSelectedPins,
} from "./interaction-pin-select";
import { PLACE_COMMANDS, stopPlacing } from "./interaction-place";
import { dismissGhosts, SUGGEST_COMMANDS } from "./interaction-suggest";
import { completionFor, legalTargets } from "./wiring-targets";

type PinHit = Extract<Hit, { type: "pin" }>;

const announce = (announcement: Extract<Effect, { type: "announce" }>["announcement"]): Effect => ({
  type: "announce",
  announcement,
});

export const refOf = (hit: PinHit): PinRef => ({ instanceId: hit.instanceId, pin: hit.pin });

/** The state with nothing armed, the bit picker closed and no wire being drawn. */
const unarmed = (state: InteractionState): InteractionState => {
  const { armed: _armed, bitPick: _bitPick, drag, ...rest } = state;
  return drag === undefined || drag.kind === "wire" ? rest : { ...rest, drag };
};

/** Cancels wiring, saying so; the rest of the state is kept. */
export const disarmed = (state: InteractionState): Interpreted =>
  done(unarmed(state), announce({ type: "disarmed" }));

/** Where a new wire starts and the colour it gets; `undefined` is the default colour. */
export interface Start {
  readonly end: PinRef;
  readonly color: WireColor | undefined;
}

export const colorOf = (color: WireColor | undefined): { readonly color?: WireColor } =>
  color === undefined ? {} : { color };

/** Arms `end` with its legal targets, worked out once here; it stops a placement (D6). */
export const arm = (
  state: InteractionState,
  { end, color }: Start,
  context: InteractionContext,
): Interpreted => {
  const armed = { end, legal: legalTargets(context.scene, end), ...colorOf(color) };
  const { bitPick: _bitPick, placing: _placing, ...rest } = state;
  return done(
    { ...rest, armed },
    announce({ type: "armed", instanceId: end.instanceId, pin: end.pin }),
  );
};

/** Arms a pin with the next wire colour. */
const armPin = (state: InteractionState, end: PinRef, context: InteractionContext): Interpreted =>
  arm(state, { end, color: state.wireColor }, context);

const connected = (
  state: InteractionState,
  ends: { readonly from: PinRef; readonly to: PinRef; readonly color?: WireColor },
  context: InteractionContext,
): Interpreted =>
  done(
    unarmed(state),
    {
      type: "dispatch",
      action: { type: "connectWire", chipId: context.chipId, wireId: context.newWireId(), ...ends },
    },
    announce({ type: "wired" }),
  );

/** Why a connection was refused: shown over the canvas as `notice` and announced. */
export const refused = ({ state, effects }: Interpreted, reason: ConnectionError): Interpreted => ({
  state: { ...state, notice: reason },
  effects: [...effects, announce({ type: "refused", reason })],
});

/** Where the armed pin is aimed: the target pin, and where a bit picker would point. */
export interface Aim {
  readonly target: PinRef;
  readonly screen: Point;
}

/**
 * `armed` meets the aimed pin: it connects, opens the bit picker, or arms the target instead and
 * says why it could not connect.
 */
export const complete = (
  state: InteractionState,
  { armed, target, screen }: Aim & { readonly armed: Armed },
  context: InteractionContext,
): Interpreted => {
  const color = colorOf(armed.color);
  const completion = completionFor(context.scene, armed.end, target);
  if (completion.type === "connect") {
    return connected(state, { from: completion.from, to: completion.to, ...color }, context);
  }
  if (completion.type === "pickBit") {
    const { bus, bits } = completion;
    return done({ ...state, bitPick: { armed: armed.end, target, bus, bits, screen, ...color } });
  }
  const rearmed = armPin(state, target, context);
  // Tapping the armed pin again only re-arms it: that is no attempt to connect.
  const again = target.instanceId === armed.end.instanceId && target.pin === armed.end.pin;
  return again ? rearmed : refused(rearmed, completion.reason);
};

/** A pin is aimed at (tapped, chosen by key or under a released drag): wire it, or arm it. */
const reach = (state: InteractionState, aim: Aim, context: InteractionContext): Interpreted =>
  state.armed === undefined
    ? armPin(state, aim.target, context)
    : complete(state, { ...aim, armed: state.armed }, context);

/** Pins are selected and none is armed: a pin aimed at is the source that wires them (D4). */
const wiresPins = (state: InteractionState): boolean =>
  state.armed === undefined && state.selection.pins.length > 0;

/**
 * A tap on a pin: it picks it (`additive`, or Pick pins), wires the selected pins to it, arms it,
 * or completes the wire from the armed pin.
 */
export const onPinTap = (
  state: InteractionState,
  { hit, additive }: { readonly hit: PinHit; readonly additive: boolean },
  context: InteractionContext,
): Interpreted => {
  const plain = withoutOverlays(state);
  if (additive || state.pinPick === true) {
    return togglePickedPin(plain, refOf(hit));
  }
  return wiresPins(state)
    ? wireSelectedPins(plain, refOf(hit), context)
    : reach(
        plain,
        { target: refOf(hit), screen: worldToScreen(state.camera, hit.anchor) },
        context,
      );
};

/**
 * Escape's arming step: the bit picker closes first, then a placement (keeping the selection),
 * then the armed pin (and a wire being drawn, so its release says nothing more), then the pin
 * list with Pick pins, then the suggested ghosts (D12); else `undefined`.
 */
export const cancelWiring = (state: InteractionState): Interpreted | undefined => {
  if (state.bitPick !== undefined) {
    const { bitPick: _bitPick, ...rest } = state;
    return done(rest);
  }
  return (
    stopPlacing(state) ??
    (state.armed === undefined ? (clearPins(state) ?? dismissGhosts(state)) : disarmed(state))
  );
};

/** `w`: arms the pin in the card, else the focused chip's first pin. */
const armByKey = (state: InteractionState, context: InteractionContext): Interpreted => {
  if (state.card !== undefined) {
    return armPin(state, { instanceId: state.card.instanceId, pin: state.card.pin }, context);
  }
  const instance = context.scene.circuit.instances.find((item) => item.id === state.focus);
  const [first] = instance === undefined ? [] : layoutIn(context.scene, instance).pins;
  return instance === undefined || first === undefined
    ? done(state)
    : armPin(state, { instanceId: instance.id, pin: first.key }, context);
};

/** `Enter` while armed or with pins selected: wires them to the pin in the card. */
const connectByKey = (state: InteractionState, context: InteractionContext): Interpreted => {
  const { card } = state;
  if (card === undefined || (state.armed === undefined && !wiresPins(state))) {
    return done(state);
  }
  const target = { instanceId: card.instanceId, pin: card.pin };
  return wiresPins(state)
    ? wireSelectedPins(state, target, context)
    : reach(state, { target, screen: card.screen }, context);
};

/** A bit chosen in the picker goes on the bus end, and the wire connects if still legal. */
const pickBit = (
  state: InteractionState,
  bit: number,
  context: InteractionContext,
): Interpreted => {
  const pick = state.bitPick;
  if (pick === undefined || !pick.bits.includes(bit)) {
    return done(state);
  }
  const armed = pick.bus === "armed" ? { ...pick.armed, bit } : pick.armed;
  const target = pick.bus === "target" ? { ...pick.target, bit } : pick.target;
  const completion = completionFor(context.scene, armed, target);
  return completion.type === "connect"
    ? connected(
        state,
        { from: completion.from, to: completion.to, ...colorOf(pick.color) },
        context,
      )
    : done(withoutOverlays(state));
};

const setWireColor = (state: InteractionState, color: WireColor | undefined): Interpreted => {
  const { wireColor: _wireColor, ...rest } = state;
  return done(color === undefined ? rest : { ...rest, wireColor: color });
};

type Of<Type extends InteractionCommand["type"]> = Extract<InteractionCommand, { type: Type }>;

type WiringHandlers = {
  readonly [Type in "arm" | "connect" | "pickBit" | "setWireColor"]: (
    state: InteractionState,
    command: Of<Type>,
    context: InteractionContext,
  ) => Interpreted;
};

/**
 * The arming commands, for the command table: a pin's (`arm`, `connect`, `pickBit`,
 * `setWireColor`) and a part's placement. Arming either disarms the other (D6).
 */
export const WIRING_COMMANDS: WiringHandlers &
  typeof PLACE_COMMANDS &
  typeof PIN_SELECT_COMMANDS &
  typeof SUGGEST_COMMANDS = {
  arm: (state, _command, context) => armByKey(state, context),
  connect: (state, _command, context) => connectByKey(state, context),
  pickBit: (state, command, context) => pickBit(state, command.bit, context),
  setWireColor: (state, command) => setWireColor(state, command.color),
  ...PLACE_COMMANDS,
  ...PIN_SELECT_COMMANDS,
  ...SUGGEST_COMMANDS,
};
