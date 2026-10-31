import type { Point } from "~/features/projects";
import type { WireId } from "~/shared/ids";

import { bendHandles, bentRoute, handleAt, moveSegment } from "./bend-geometry";
import type { BendHandle } from "./bend-geometry";
import type { Gesture } from "./gesture-types";
import { done, withoutOverlays } from "./interaction";
import type {
  Drag,
  Effect,
  InteractionContext,
  InteractionState,
  Interpreted,
} from "./interaction";
import { toWorld } from "./interaction-hits";

type SegmentDrag = Extract<Drag, { kind: "segment" }>;

/** Half a handle (24 px): how far from a segment's midpoint a press grabs it, in screen px. */
const HANDLE_REACH_PX = 12;

const announceBends = (active: boolean): Effect => ({
  type: "announce",
  announcement: { type: "bends", active },
});

/** Bend mode for `wireId`, its first interior segment focused, announced; menus close. */
export const enterBends = (
  state: InteractionState,
  wireId: WireId,
  context: InteractionContext,
): Interpreted => {
  const [first] = bendHandles(context.scene, wireId);
  const bends = { wireId, segment: first?.index ?? 1 };
  return done({ ...withoutOverlays(state), bends }, announceBends(true));
};

/** The state out of bend mode. */
const withoutBends = (state: InteractionState): InteractionState => {
  const { bends: _bends, ...rest } = state;
  return rest;
};

/** Leaves bend mode, saying so. */
export const leaveBends = (state: InteractionState): Interpreted =>
  done(withoutBends(state), announceBends(false));

/** The handle of the wire in bend mode under `screen`, if any. */
const handleUnder = (
  state: InteractionState,
  screen: Point,
  context: InteractionContext,
): (BendHandle & { readonly wireId: WireId }) | undefined => {
  const { bends } = state;
  const handle =
    bends &&
    handleAt(
      bendHandles(context.scene, bends.wireId),
      toWorld(state, screen),
      HANDLE_REACH_PX / state.camera.zoom,
    );
  return bends && handle && { ...handle, wireId: bends.wireId };
};

/**
 * A tap in bend mode: on a handle it does nothing (`undefined`); anywhere else it leaves bend
 * mode, announced, and the returned state is what the tap then acts on.
 */
export const tappedInBends = (
  state: InteractionState,
  screen: Point,
  context: InteractionContext,
): Interpreted | undefined => {
  if (state.bends === undefined) {
    return done(state);
  }
  return handleUnder(state, screen, context) === undefined ? leaveBends(state) : undefined;
};

/**
 * A drag from a handle in bend mode moves its segment, which becomes the focused one; else, or
 * with Space, `undefined`.
 */
export const startSegmentDrag = (
  state: InteractionState,
  gesture: Extract<Gesture, { type: "dragStart" }>,
  context: InteractionContext,
): Interpreted | undefined => {
  const handle = gesture.modifiers.space ? undefined : handleUnder(state, gesture.origin, context);
  if (handle === undefined) {
    return undefined;
  }
  const { hover: _hover, ...rest } = withoutOverlays(state);
  const { wireId, index, axis } = handle;
  const drag: SegmentDrag = {
    kind: "segment",
    wireId,
    index,
    axis,
    origin: toWorld(state, gesture.origin),
    offset: 0,
  };
  return done({ ...rest, lassoArmed: false, bends: { wireId, segment: index }, drag });
};

/** The segment drag following the pointer at `world`. */
export const segmentMoved = (drag: SegmentDrag, world: Point): SegmentDrag => ({
  ...drag,
  offset: world[drag.axis] - drag.origin[drag.axis],
});

const samePoints = (first: readonly Point[], second: readonly Point[]): boolean =>
  first.length === second.length &&
  first.every((point, at) => point.x === second[at]?.x && point.y === second[at]?.y);

/** The one `moveWaypoint` that moves segment `index` of `wireId` by `offset`; none if it stays. */
export const segmentEdit = (
  context: InteractionContext,
  wireId: WireId,
  { index, offset }: { readonly index: number; readonly offset: number },
): readonly Effect[] => {
  const route = bentRoute(context.scene, wireId);
  const waypoints = moveSegment(route, index, offset);
  return samePoints(waypoints, route.slice(1, -1))
    ? []
    : [
        {
          type: "dispatch",
          action: { type: "moveWaypoint", chipId: context.chipId, wireId, waypoints },
        },
      ];
};

/** A segment drag ended: one `moveWaypoint` with the new bends, unless nothing moved. */
export const endSegmentDrag = (
  state: InteractionState,
  drag: SegmentDrag,
  context: InteractionContext,
): Interpreted => done(state, ...segmentEdit(context, drag.wireId, drag));
