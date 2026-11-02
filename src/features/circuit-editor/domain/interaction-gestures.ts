import { panBy, worldToScreen, zoomAt } from "./camera";
import type { Gesture } from "./gesture-types";
import type { Hit } from "./hit-test";
import { done, selected, withoutOverlays } from "./interaction";
import type { InteractionContext, InteractionState, Interpreted } from "./interaction";
import { onDragCancel, onDragEnd, onDragMove, onDragStart } from "./interaction-drag";
import { chipOf, hitAt } from "./interaction-hits";
import { openCanvasMenu, openWireMenu, withMenu } from "./interaction-menus";
import { onTap } from "./interaction-tap";
import { selectInstances } from "./selection";

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
  if (hit.type === "chip" || hit.type === "label") {
    return withMenu(selected(state, selectInstances([hit.instanceId]), hit.instanceId), {
      kind: "chip",
      instanceId: hit.instanceId,
      screen: gesture.point,
    });
  }
  if (hit.type === "wire") {
    return openWireMenu(state, hit.wireId, gesture.point);
  }
  // Long-press on empty canvas arms the lasso; the canvas menu is a right-click or `Enter`.
  return done({ ...withoutOverlays(state), lassoArmed: state.tool === "select" });
};

/** A right-click: the chip menu on a chip or pin, the wire menu on a wire, else the canvas menu. */
const onContextMenu = (
  state: InteractionState,
  gesture: Of<"contextMenu">,
  context: InteractionContext,
): Interpreted => {
  const hit = hitAt(state, context, gesture.point);
  const instanceId = chipOf(hit);
  if (instanceId !== undefined) {
    return withMenu(selected(state, selectInstances([instanceId]), instanceId), {
      kind: "chip",
      instanceId,
      screen: gesture.point,
    });
  }
  return hit.type === "wire"
    ? openWireMenu(state, hit.wireId, gesture.point)
    : openCanvasMenu(state, gesture.point);
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
