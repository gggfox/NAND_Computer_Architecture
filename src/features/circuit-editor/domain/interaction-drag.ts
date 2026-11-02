/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assertNever } from "~/shared/assert-never";

import { panBy } from "./camera";
import type { Gesture } from "./gesture-types";
import { done, previewOf, selected, withoutOverlays } from "./interaction";
import type { Drag, InteractionContext, InteractionState, Interpreted } from "./interaction";
import { endSegmentDrag, segmentMoved, startSegmentDrag } from "./interaction-bends";
import { chipOf, hitAt, toWorld } from "./interaction-hits";
import { endMarquee, marqueePoints } from "./interaction-marquee";
import { disarmed, endWireDrag, startWireDrag } from "./interaction-wiring";
import { movesFor } from "./move";
import { selectInstances } from "./selection";

type Of<Type extends Gesture["type"]> = Extract<Gesture, { type: Type }>;
type Point = Of<"dragMove">["point"];

/**
 * A drag from a chip body moves the selection (from a pin or a wire it draws a wire instead, see
 * `startWireDrag`); elsewhere it pans or draws a marquee. The lasso needs Alt, or a drag that
 * continues the long-press that armed it: a fresh press draws a box.
 */
const dragFor = (state: InteractionState, gesture: Of<"dragStart">, onChip: boolean): Drag => {
  const { space, alt, shift } = gesture.modifiers;
  if (onChip && !space) {
    return { kind: "move", origin: toWorld(state, gesture.origin), delta: { x: 0, y: 0 } };
  }
  if (state.tool === "pan" || space) {
    return { kind: "pan", last: gesture.origin };
  }
  const shape = (state.lassoArmed && gesture.afterLongPress) || alt ? "lasso" : "box";
  return { kind: "marquee", shape, points: [toWorld(state, gesture.origin)], additive: shift };
};

export const onDragStart = (
  state: InteractionState,
  gesture: Of<"dragStart">,
  context: InteractionContext,
): Interpreted => {
  const hit = hitAt(state, context, gesture.origin);
  // A bend handle beats the wire under it; a pin or a wire (in the Select tool) draws a wire.
  const special =
    startSegmentDrag(state, gesture, context) ?? startWireDrag(state, { gesture, hit }, context);
  if (special !== undefined) {
    return onDragMove(special.state, { type: "dragMove", point: gesture.point }, special.effects);
  }
  const instanceId = chipOf(hit);
  const drag = dragFor(state, gesture, instanceId !== undefined);
  const keep =
    drag.kind !== "move" || instanceId === undefined || state.selection.instances.has(instanceId);
  const base = keep
    ? done(withoutOverlays(state))
    : selected(state, selectInstances([instanceId]), instanceId);
  // The hover ring marks where a pin was; a drag moves chips away from it, so it goes.
  const { hover: _hover, ...rest } = base.state;
  return onDragMove(
    { ...rest, drag, lassoArmed: false },
    { type: "dragMove", point: gesture.point },
    base.effects,
  );
};

const moved = (drag: Drag, state: InteractionState, point: Point): Drag => {
  switch (drag.kind) {
    case "move": {
      const world = toWorld(state, point);
      return { ...drag, delta: { x: world.x - drag.origin.x, y: world.y - drag.origin.y } };
    }
    case "pan": {
      return { kind: "pan", last: point };
    }
    case "marquee": {
      return { ...drag, points: marqueePoints(drag, toWorld(state, point)) };
    }
    case "wire": {
      return { ...drag, point: toWorld(state, point) };
    }
    case "segment": {
      return segmentMoved(drag, toWorld(state, point));
    }
    default: {
      return assertNever(drag);
    }
  }
};

export const onDragMove = (
  state: InteractionState,
  gesture: Of<"dragMove">,
  effects: Interpreted["effects"] = [],
): Interpreted => {
  const { drag } = state;
  if (drag === undefined) {
    return done(state, ...effects);
  }
  const camera =
    drag.kind === "pan"
      ? panBy(state.camera, { x: gesture.point.x - drag.last.x, y: gesture.point.y - drag.last.y })
      : state.camera;
  return done({ ...state, camera, drag: moved(drag, state, gesture.point) }, ...effects);
};

/** The moves of the drag in `state` as one action; its returned state is the caller's to replace. */
const endMove = (state: InteractionState, context: InteractionContext): Interpreted => {
  const { scene } = context;
  const moves = movesFor(scene.circuit, previewOf(state, scene));
  return moves.length === 0
    ? done(state)
    : done(
        state,
        { type: "dispatch", action: { type: "moveChips", chipId: context.chipId, moves } },
        { type: "announce", announcement: { type: "moved", count: moves.length } },
      );
};

export const onDragEnd = (
  state: InteractionState,
  gesture: Of<"dragEnd">,
  context: InteractionContext,
): Interpreted => {
  const current = onDragMove(state, { type: "dragMove", point: gesture.point }).state;
  const { drag, ...rest } = current;
  switch (drag?.kind) {
    case "move": {
      return { ...endMove(current, context), state: rest };
    }
    case "marquee": {
      return endMarquee(rest, drag, context);
    }
    case "pan": {
      return done(rest, { type: "cameraSettled" });
    }
    case "wire": {
      return endWireDrag(rest, drag, context);
    }
    case "segment": {
      return endSegmentDrag(rest, drag, context);
    }
    case undefined: {
      return done(rest);
    }
    default: {
      return assertNever(drag);
    }
  }
};

export const onDragCancel = (state: InteractionState): Interpreted => {
  const { drag, ...rest } = state;
  if (drag?.kind === "wire") {
    return disarmed(rest);
  }
  return drag?.kind === "pan" ? done(rest, { type: "cameraSettled" }) : done(rest);
};
