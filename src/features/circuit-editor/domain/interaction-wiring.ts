import type { PinRef, Point, WireColor } from "~/features/projects";

import { worldToScreen } from "./camera";
import { layoutIn } from "./geometry";
import type { Gesture } from "./gesture-types";
import { nearestPin } from "./hit-test";
import type { Hit } from "./hit-test";
import { done, withoutOverlays } from "./interaction";
import type {
  Armed,
  Drag,
  Effect,
  InteractionCommand,
  InteractionContext,
  InteractionState,
  Interpreted,
} from "./interaction";
import { toWorld } from "./interaction-hits";
import { pinLevelKey } from "./signals";
import { completionFor, legalTargets } from "./wiring-targets";

type PinHit = Extract<Hit, { type: "pin" }>;
type WireDrag = Extract<Drag, { kind: "wire" }>;

/** Half the smallest target (24 px): how far a released wire reaches for a pin, in screen px. */
const REACH_PX = 12;

const announce = (announcement: Extract<Effect, { type: "announce" }>["announcement"]): Effect => ({
  type: "announce",
  announcement,
});

const refOf = (hit: PinHit): PinRef => ({ instanceId: hit.instanceId, pin: hit.pin });

/** The state with nothing armed, the bit picker closed and no wire being drawn. */
const unarmed = (state: InteractionState): InteractionState => {
  const { armed: _armed, bitPick: _bitPick, drag, ...rest } = state;
  return drag === undefined || drag.kind === "wire" ? rest : { ...rest, drag };
};

/** Cancels wiring, saying so; the rest of the state is kept. */
export const disarmed = (state: InteractionState): Interpreted =>
  done(unarmed(state), announce({ type: "disarmed" }));

/** Where a new wire starts and the colour it gets; `undefined` is the default colour. */
interface Start {
  readonly end: PinRef;
  readonly color: WireColor | undefined;
}

const colorOf = (color: WireColor | undefined): { readonly color?: WireColor } =>
  color === undefined ? {} : { color };

/** Arms `end` with its legal targets, worked out once here. */
export const arm = (
  state: InteractionState,
  { end, color }: Start,
  context: InteractionContext,
): Interpreted => {
  const armed = { end, legal: legalTargets(context.scene, end), ...colorOf(color) };
  const { bitPick: _bitPick, ...rest } = state;
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

/** Where the armed pin is aimed: the target pin, and where a bit picker would point. */
interface Aim {
  readonly target: PinRef;
  readonly screen: Point;
}

/** `armed` meets the aimed pin: it connects, opens the bit picker, or arms the target instead. */
const complete = (
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
  return armPin(state, target, context);
};

/** A pin is aimed at (tapped, chosen by key or under a released drag): wire it, or arm it. */
const reach = (state: InteractionState, aim: Aim, context: InteractionContext): Interpreted =>
  state.armed === undefined
    ? armPin(state, aim.target, context)
    : complete(state, { ...aim, armed: state.armed }, context);

/** A tap on a pin: it arms it, or completes the wire from the armed pin. */
export const onPinTap = (
  state: InteractionState,
  hit: PinHit,
  context: InteractionContext,
): Interpreted =>
  reach(
    withoutOverlays(state),
    { target: refOf(hit), screen: worldToScreen(state.camera, hit.anchor) },
    context,
  );

/**
 * A drag from a pin starts at it; one from a wire branches from that wire's source, in its
 * colour, except in the Pan tool, where a drag on a wire pans.
 */
const startOf = (
  state: InteractionState,
  hit: Hit,
  context: InteractionContext,
): Start | undefined => {
  if (hit.type === "pin") {
    return { end: refOf(hit), color: state.wireColor };
  }
  const wire =
    hit.type === "wire" && state.tool === "select"
      ? context.scene.circuit.wires.find((item) => item.id === hit.wireId)
      : undefined;
  return wire && { end: wire.from, color: wire.color };
};

/** A drag that draws a wire, from a pin or (a branch) from a wire; else, or with Space, `undefined`. */
export const startWireDrag = (
  state: InteractionState,
  {
    gesture,
    hit,
  }: { readonly gesture: Extract<Gesture, { type: "dragStart" }>; readonly hit: Hit },
  context: InteractionContext,
): Interpreted | undefined => {
  const start = gesture.modifiers.space ? undefined : startOf(state, hit, context);
  if (start === undefined) {
    return undefined;
  }
  const armed = arm(withoutOverlays(state), start, context);
  const drag: WireDrag = {
    kind: "wire",
    from: start.end,
    point: toWorld(state, gesture.origin),
    ...colorOf(start.color),
  };
  // A hover ring would stay at the pin the wire leaves, as it would for a chip move.
  const { hover: _hover, ...rest } = armed.state;
  return { ...armed, state: { ...rest, drag } };
};

/** A wire drag ended: it connects to the nearest legal pin within reach, else nothing is wired. */
export const endWireDrag = (
  state: InteractionState,
  drag: WireDrag,
  context: InteractionContext,
): Interpreted => {
  const legal = state.armed?.legal ?? new Set<string>();
  const target = nearestPin(context.index(), drag.point, {
    reach: REACH_PX / state.camera.zoom,
    accept: (hit) => legal.has(pinLevelKey(hit.instanceId, hit.pin)),
  });
  // The wire is drawn from where the drag started, whatever else was armed meanwhile.
  const armed: Armed = { end: drag.from, legal, ...colorOf(drag.color) };
  return target === undefined
    ? disarmed(state)
    : complete(
        state,
        { armed, target: refOf(target), screen: worldToScreen(state.camera, target.anchor) },
        context,
      );
};

/**
 * Escape's wiring step: the bit picker closes first, then the armed pin (and a wire being drawn,
 * so its release says nothing more); else `undefined`.
 */
export const cancelWiring = (state: InteractionState): Interpreted | undefined => {
  if (state.bitPick !== undefined) {
    const { bitPick: _bitPick, ...rest } = state;
    return done(rest);
  }
  return state.armed === undefined ? undefined : disarmed(state);
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

/** `Enter` while armed: wires the armed pin to the pin in the card. */
const connectByKey = (state: InteractionState, context: InteractionContext): Interpreted => {
  const { card } = state;
  return state.armed === undefined || card === undefined
    ? done(state)
    : reach(
        state,
        { target: { instanceId: card.instanceId, pin: card.pin }, screen: card.screen },
        context,
      );
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

/** The wiring commands, for the command table: `arm`, `connect`, `pickBit` and `setWireColor`. */
export const WIRING_COMMANDS: WiringHandlers = {
  arm: (state, _command, context) => armByKey(state, context),
  connect: (state, _command, context) => connectByKey(state, context),
  pickBit: (state, command, context) => pickBit(state, command.bit, context),
  setWireColor: (state, command) => setWireColor(state, command.color),
};
