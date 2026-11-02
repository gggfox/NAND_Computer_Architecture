import type { InstanceId } from "~/shared/ids";

import type { Gesture } from "./gesture-types";
import type { Hit } from "./hit-test";
import { done, selected, withoutOverlays } from "./interaction";
import type { InteractionContext, InteractionState, Interpreted } from "./interaction";
import { tappedInBends } from "./interaction-bends";
import { hitAt } from "./interaction-hits";
import { startRename, withToggle } from "./interaction-pins";
import { disarmed, onPinTap } from "./interaction-wiring";
import { selectInstances, selectWire, toggleInstance, toggleWire } from "./selection";

type PinHit = Extract<Hit, { type: "pin" }>;
type Tap = Extract<Gesture, { type: "tap" }>;

/** A tap on empty canvas clears the selection; typed so a new kind of hit fails to compile. */
const emptyTap = (state: InteractionState, _hit: Extract<Hit, { type: "empty" }>): Interpreted =>
  selected(state, selectInstances([]));

/** A tap on a chip selects it; a plain one on a 1-bit input piece also flips its value. */
const chipTap = (
  state: InteractionState,
  { gesture, instanceId }: { readonly gesture: Tap; readonly instanceId: InstanceId },
  context: InteractionContext,
): Interpreted =>
  gesture.modifiers.shift
    ? selected(state, toggleInstance(state.selection, instanceId), instanceId)
    : withToggle(selected(state, selectInstances([instanceId]), instanceId), instanceId, context);

/** A tap on a chip, a pin piece's name, a wire or empty canvas, with nothing armed. */
const plainTap = (
  state: InteractionState,
  gesture: Tap,
  { hit, context }: { readonly hit: Exclude<Hit, PinHit>; readonly context: InteractionContext },
): Interpreted => {
  const { shift } = gesture.modifiers;
  if (hit.type === "chip") {
    return chipTap(state, { gesture, instanceId: hit.instanceId }, context);
  }
  if (hit.type === "label") {
    return startRename(state, hit.instanceId, context);
  }
  if (hit.type === "wire") {
    return selected(
      state,
      shift ? toggleWire(state.selection, hit.wireId) : selectWire(hit.wireId),
    );
  }
  return emptyTap(state, hit);
};

/**
 * A tap on a pin arms it or completes a wire. With a pin armed, a tap on empty canvas cancels;
 * on a chip or a wire it cancels and then acts as a tap.
 */
const tapAt = (state: InteractionState, gesture: Tap, context: InteractionContext): Interpreted => {
  const hit = hitAt(state, context, gesture.point);
  if (hit.type === "pin") {
    return onPinTap(state, hit, context);
  }
  if (state.armed === undefined) {
    return plainTap(state, gesture, { hit, context });
  }
  const cancelled = disarmed(withoutOverlays(state));
  if (hit.type === "empty") {
    return cancelled;
  }
  const tapped = plainTap(cancelled.state, gesture, { hit, context });
  return { ...tapped, effects: [...cancelled.effects, ...tapped.effects] };
};

/** A tap. In bend mode, one on a handle does nothing; any other leaves bend mode first. */
export const onTap = (
  state: InteractionState,
  gesture: Tap,
  context: InteractionContext,
): Interpreted => {
  const left = tappedInBends(state, gesture.point, context);
  if (left === undefined) {
    return done(state);
  }
  const tapped = tapAt(left.state, gesture, context);
  return { ...tapped, effects: [...left.effects, ...tapped.effects] };
};
