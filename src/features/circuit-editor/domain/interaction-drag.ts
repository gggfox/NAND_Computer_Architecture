/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Point } from "~/features/projects";
import { assertNever } from "~/shared/assert-never";

import { panBy } from "./camera";
import type { Rect } from "./chip-layout";
import type { Gesture } from "./gesture-types";
import { chipsIn } from "./hit-test";
import type { Hit } from "./hit-test";
import { done, previewOf, selected, withoutOverlays } from "./interaction";
import type { Drag, InteractionContext, InteractionState, Interpreted } from "./interaction";
import { chipOf, hitAt, toWorld } from "./interaction-hits";
import { movesFor } from "./move";
import { addInstances, inBox, inLasso, selectInstances, withInnerWires } from "./selection";

type Of<Type extends Gesture["type"]> = Extract<Gesture, { type: Type }>;

/**
 * A drag from a chip (or its pin) moves the selection; elsewhere it pans or draws a marquee. The
 * lasso needs Alt, or a drag that continues the long-press that armed it: a fresh press draws a box.
 */
const dragFor = (state: InteractionState, gesture: Of<"dragStart">, hit: Hit): Drag => {
  const { space, alt, shift } = gesture.modifiers;
  if (chipOf(hit) !== undefined && !space) {
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
  const drag = dragFor(state, gesture, hit);
  const instanceId = chipOf(hit);
  const keep =
    drag.kind !== "move" || instanceId === undefined || state.selection.instances.has(instanceId);
  const base = keep
    ? done(withoutOverlays(state))
    : selected(state, selectInstances([instanceId]), instanceId);
  return onDragMove(
    { ...base.state, drag, lassoArmed: false },
    { type: "dragMove", point: gesture.point },
    base.effects,
  );
};

const marqueePoints = (drag: Drag & { kind: "marquee" }, world: Point): readonly Point[] =>
  drag.shape === "lasso" ? [...drag.points, world] : [drag.points[0] ?? world, world];

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

const boundsOfPoints = (points: readonly Point[]): Rect => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const [x, y] = [Math.min(...xs), Math.min(...ys)];
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

const endMarquee = (
  state: InteractionState,
  drag: Drag & { kind: "marquee" },
  context: InteractionContext,
): Interpreted => {
  const bounds = boundsOfPoints(drag.points);
  const chips = chipsIn(context.index(), bounds);
  const ids = drag.shape === "box" ? inBox(chips, bounds) : inLasso(chips, drag.points);
  const base = drag.additive ? addInstances(state.selection, ids) : selectInstances(ids);
  return selected(state, withInnerWires(context.scene.circuit, base));
};

/** The moves of the drag in `state` as one action; its returned state is the caller's to replace. */
const endMove = (state: InteractionState, context: InteractionContext): Interpreted => {
  const { circuit } = context.scene;
  const moves = movesFor(circuit, previewOf(state, circuit));
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
  return drag?.kind === "pan" ? done(rest, { type: "cameraSettled" }) : done(rest);
};
