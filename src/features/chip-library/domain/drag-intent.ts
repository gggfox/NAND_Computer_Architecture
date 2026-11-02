import type { Point } from "~/features/projects";

/** How long a finger must rest on a row before the long-press counts. */
export const LONG_PRESS_MS = 400;
/** Pixels a still finger may wander before the long-press is lost. */
export const TOUCH_SLOP = 8;
/** Pixels a mouse must move to start a drag. */
export const MOUSE_THRESHOLD = 4;

type PointerKind = "mouse" | "touch" | "pen";

export type DragIntent =
  | { readonly phase: "idle" }
  | {
      readonly phase: "pressing";
      readonly pointer: PointerKind;
      readonly origin: Point;
      readonly since: number;
    }
  | { readonly phase: "held"; readonly origin: Point }
  | { readonly phase: "dragging"; readonly point: Point }
  | { readonly phase: "scrolling" };

export type IntentEvent =
  | {
      readonly type: "down";
      readonly pointer: PointerKind;
      readonly point: Point;
      readonly at: number;
    }
  | { readonly type: "move"; readonly point: Point; readonly at: number }
  | { readonly type: "tick"; readonly at: number }
  | { readonly type: "up" | "cancel" };

export type IntentOutcome = "none" | "menu" | "drop" | "tap";

interface Step {
  readonly intent: DragIntent;
  readonly outcome: IntentOutcome;
}

const IDLE: DragIntent = { phase: "idle" };
const stay = (intent: DragIntent): Step => ({ intent, outcome: "none" });
const finish = (outcome: IntentOutcome): Step => ({ intent: IDLE, outcome });

const distance = (from: Point, to: Point): number => Math.hypot(to.x - from.x, to.y - from.y);

type Pressing = Extract<DragIntent, { phase: "pressing" }>;
type Held = Extract<DragIntent, { phase: "held" }>;

const isLongPress = (intent: Pressing, at: number): boolean =>
  intent.pointer !== "mouse" && at - intent.since >= LONG_PRESS_MS;

const held = (intent: Pressing): Held => ({ phase: "held", origin: intent.origin });

function movePressing(intent: Pressing, point: Point, at: number): Step {
  if (isLongPress(intent, at)) {
    return moveHeld(held(intent), point);
  }
  const moved = distance(intent.origin, point);
  if (intent.pointer === "mouse") {
    return stay(moved >= MOUSE_THRESHOLD ? { phase: "dragging", point } : intent);
  }
  return stay(moved > TOUCH_SLOP ? { phase: "scrolling" } : intent);
}

function moveHeld(intent: Held, point: Point): Step {
  return stay(distance(intent.origin, point) > TOUCH_SLOP ? { phase: "dragging", point } : intent);
}

function onMove(intent: DragIntent, point: Point, at: number): Step {
  if (intent.phase === "pressing") {
    return movePressing(intent, point, at);
  }
  if (intent.phase === "held") {
    return moveHeld(intent, point);
  }
  return stay(intent.phase === "dragging" ? { phase: "dragging", point } : intent);
}

// `up` carries no clock, so a press that never ticked into `held` is a tap.
const RELEASE_OUTCOME: Readonly<Record<DragIntent["phase"], IntentOutcome>> = {
  idle: "none",
  pressing: "tap",
  held: "menu",
  dragging: "drop",
  scrolling: "none",
};

function onTick(intent: DragIntent, at: number): Step {
  return stay(intent.phase === "pressing" && isLongPress(intent, at) ? held(intent) : intent);
}

/** Reads a pointer's press, move and release as one intent: tap, menu, drag or list scroll. */
export const stepIntent = (intent: DragIntent, event: IntentEvent): Step => {
  if (event.type === "down") {
    return stay({
      phase: "pressing",
      pointer: event.pointer,
      origin: event.point,
      since: event.at,
    });
  }
  if (event.type === "move") {
    return onMove(intent, event.point, event.at);
  }
  if (event.type === "tick") {
    return onTick(intent, event.at);
  }
  return finish(event.type === "up" ? RELEASE_OUTCOME[intent.phase] : "none");
};
