import type { PinRef } from "~/features/projects";

import { worldToScreen } from "./camera";
import type { Drag, Gesture } from "./gesture-types";
import { nearestPin } from "./hit-test";
import type { Hit } from "./hit-test";
import { withoutOverlays } from "./interaction";
import type { Armed, InteractionContext, InteractionState, Interpreted } from "./interaction";
import { toWorld } from "./interaction-hits";
import { arm, colorOf, complete, disarmed, refOf, refused } from "./interaction-wiring";
import type { Start } from "./interaction-wiring";
import { pinLevelKey } from "./signals";
import { completionFor, legalTargets } from "./wiring-targets";

type WireDrag = Extract<Drag, { kind: "wire" }>;

/** Half the smallest target (24 px): how far a released wire reaches for a pin, in screen px. */
const REACH_PX = 12;

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

/** A wire drag cancelled cancels wiring too. */
export const cancelWireDrag = (state: InteractionState): Interpreted => disarmed(state);

const sameEnd = (first: PinRef, second: PinRef): boolean =>
  first.instanceId === second.instanceId && first.pin === second.pin && first.bit === second.bit;

/**
 * No legal pin is within reach: when another pin is, nothing is wired and the refusal says why;
 * a drop on nothing, or back on the pin the drag started at, just cancels.
 */
const missed = (state: InteractionState, drag: WireDrag, context: InteractionContext) => {
  const near = nearestPin(context.index(), drag.point, {
    reach: REACH_PX / state.camera.zoom,
    accept: (hit) => hit.instanceId !== drag.from.instanceId || hit.pin !== drag.from.pin,
  });
  const completion = near && completionFor(context.scene, drag.from, refOf(near));
  return completion?.type === "illegal"
    ? refused(disarmed(state), completion.reason)
    : disarmed(state);
};

/** A wire drag ended: it connects to the nearest legal pin within reach, else nothing is wired. */
export const endWireDrag = (
  state: InteractionState,
  drag: WireDrag,
  context: InteractionContext,
): Interpreted => {
  // `w` may have armed another pin mid-drag; the drop is legal for the pin the drag started at.
  // With nothing armed (wiring was cancelled), nothing is.
  const { armed: current } = state;
  const legal =
    current === undefined || sameEnd(current.end, drag.from)
      ? (current?.legal ?? new Set<string>())
      : legalTargets(context.scene, drag.from);
  const target = nearestPin(context.index(), drag.point, {
    reach: REACH_PX / state.camera.zoom,
    accept: (hit) => legal.has(pinLevelKey(hit.instanceId, hit.pin)),
  });
  // The wire is drawn from where the drag started, whatever else was armed meanwhile.
  const armed: Armed = { end: drag.from, legal, ...colorOf(drag.color) };
  return target === undefined
    ? missed(state, drag, context)
    : complete(
        state,
        { armed, target: refOf(target), screen: worldToScreen(state.camera, target.anchor) },
        context,
      );
};
