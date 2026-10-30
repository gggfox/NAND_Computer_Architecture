import { assertNever } from "~/shared/assert-never";

import { panBy, worldToScreen, zoomAt } from "./camera";
import type { Gesture } from "./gesture-types";
import type { Hit } from "./hit-test";
import { done, selected, withoutOverlays } from "./interaction";
import type { InteractionContext, InteractionState, Interpreted, Menu } from "./interaction";
import { onDragCancel, onDragEnd, onDragMove, onDragStart } from "./interaction-drag";
import { chipOf, hitAt } from "./interaction-hits";
import { disarmed, onPinTap } from "./interaction-wiring";
import { selectInstances, selectWire, toggleInstance, toggleWire } from "./selection";

type Of<Type extends Gesture["type"]> = Extract<Gesture, { type: Type }>;
type PinHit = Extract<Hit, { type: "pin" }>;

/** The pin card pinned open at `hit`, announced. */
const withCard = (result: Interpreted, hit: PinHit): Interpreted => {
  const { instanceId, pin } = hit;
  const screen = worldToScreen(result.state.camera, hit.anchor);
  return {
    state: { ...result.state, card: { instanceId, pin, screen, pinned: true } },
    effects: [
      ...result.effects,
      { type: "announce", announcement: { type: "pin", instanceId, pin } },
    ],
  };
};

/** A tap on a chip, a wire or empty canvas, with nothing armed. */
const plainTap = (
  state: InteractionState,
  gesture: Of<"tap">,
  hit: Exclude<Hit, PinHit>,
): Interpreted => {
  const { shift } = gesture.modifiers;
  switch (hit.type) {
    case "chip": {
      const selection = shift
        ? toggleInstance(state.selection, hit.instanceId)
        : selectInstances([hit.instanceId]);
      return selected(state, selection, hit.instanceId);
    }
    case "wire": {
      return selected(
        state,
        shift ? toggleWire(state.selection, hit.wireId) : selectWire(hit.wireId),
      );
    }
    case "empty": {
      return selected(state, selectInstances([]));
    }
    default: {
      return assertNever(hit);
    }
  }
};

/**
 * A tap on a pin arms it or completes a wire. With a pin armed, a tap on empty canvas cancels;
 * on a chip or a wire it cancels and then acts as a tap.
 */
const onTap = (
  state: InteractionState,
  gesture: Of<"tap">,
  context: InteractionContext,
): Interpreted => {
  const hit = hitAt(state, context, gesture.point);
  if (hit.type === "pin") {
    return onPinTap(state, hit, context);
  }
  if (state.armed === undefined) {
    return plainTap(state, gesture, hit);
  }
  const cancelled = disarmed(withoutOverlays(state));
  if (hit.type === "empty") {
    return cancelled;
  }
  const tapped = plainTap(cancelled.state, gesture, hit);
  return { ...tapped, effects: [...cancelled.effects, ...tapped.effects] };
};

/** A mouse over a pin shows its card; leaving closes it, unless it was pinned open. */
const onHover = (
  state: InteractionState,
  gesture: Of<"hover">,
  context: InteractionContext,
): Interpreted => {
  const hit = hitAt(state, context, gesture.point);
  const { card, hover: _hover, ...rest } = state;
  const base: InteractionState = {
    ...rest,
    hover: hit,
    ...(card?.pinned === true ? { card } : {}),
  };
  if (hit.type !== "pin" || card?.pinned === true) {
    return done(base);
  }
  const { instanceId, pin } = hit;
  return done({
    ...base,
    card: { instanceId, pin, screen: worldToScreen(state.camera, hit.anchor), pinned: false },
  });
};

/** The mouse left the canvas: its hover and an unpinned card go with it. */
const onHoverEnd = (state: InteractionState): Interpreted => {
  const { card, hover: _hover, ...rest } = state;
  return done({ ...rest, ...(card?.pinned === true ? { card } : {}) });
};

const onLongPress = (
  state: InteractionState,
  gesture: Of<"longPress">,
  context: InteractionContext,
): Interpreted => {
  const hit = hitAt(state, context, gesture.point);
  if (hit.type === "pin") {
    return withCard(done(withoutOverlays(state)), hit);
  }
  if (hit.type === "chip") {
    return withMenu(selected(state, selectInstances([hit.instanceId]), hit.instanceId), {
      kind: "chip",
      instanceId: hit.instanceId,
      screen: gesture.point,
    });
  }
  if (hit.type === "wire") {
    return selected(state, selectWire(hit.wireId));
  }
  return done({ ...withoutOverlays(state), lassoArmed: state.tool === "select" });
};

const withMenu = (result: Interpreted, menu: Menu): Interpreted => ({
  ...result,
  state: { ...result.state, menu },
});

const onContextMenu = (
  state: InteractionState,
  gesture: Of<"contextMenu">,
  context: InteractionContext,
): Interpreted => {
  const instanceId = chipOf(hitAt(state, context, gesture.point));
  return instanceId === undefined
    ? done(withoutOverlays(state))
    : withMenu(selected(state, selectInstances([instanceId]), instanceId), {
        kind: "chip",
        instanceId,
        screen: gesture.point,
      });
};

const onPinch = (state: InteractionState, gesture: Of<"pinch">): Interpreted => ({
  state: {
    ...state,
    camera: panBy(zoomAt(state.camera, gesture.center, gesture.scale), gesture.pan),
  },
  effects: [],
});

type Handlers = {
  readonly [Type in Gesture["type"]]: (
    state: InteractionState,
    gesture: Of<Type>,
    context: InteractionContext,
  ) => Interpreted;
};

// Compiler-linked: adding a gesture without a handler here fails typecheck.
const HANDLERS: Handlers = {
  hover: onHover,
  hoverEnd: (state) => onHoverEnd(state),
  tap: onTap,
  longPress: onLongPress,
  contextMenu: onContextMenu,
  dragStart: onDragStart,
  dragMove: (state, gesture) => onDragMove(state, gesture),
  dragEnd: onDragEnd,
  dragCancel: (state) => onDragCancel(state),
  pinchStart: (state) => done(withoutOverlays(state)),
  pinch: (state, gesture) => onPinch(state, gesture),
  pinchEnd: (state) => done(state, { type: "cameraSettled" }),
};

const run = <Type extends Gesture["type"]>(
  state: InteractionState,
  gesture: Of<Type>,
  context: InteractionContext,
): Interpreted => HANDLERS[gesture.type](state, gesture, context);

/** What a recognised gesture means on the canvas. */
export const onGesture = (
  state: InteractionState,
  gesture: Gesture,
  context: InteractionContext,
): Interpreted => run(state, gesture, context);
