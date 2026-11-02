/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Point } from "~/features/projects";
import { assertNever } from "~/shared/assert-never";

import type {
  Finger,
  Gesture,
  GestureState,
  Pinch,
  PointerEventInput,
  PointerInput,
  PointerKind,
  Press,
} from "./gesture-types";

/** Movement (CSS px) before a press becomes a drag. A finger wobbles more than a mouse. */
const MOUSE_SLOP = 4;
const TOUCH_SLOP = 10;
/** A press held this long within slop is a long-press (touch and pen). */
export const LONG_PRESS_MS = 500;
const PRIMARY_BUTTON = 0;
const MIDDLE_BUTTON = 1;
const SECONDARY_BUTTON = 2;
const HALF = 0.5;

export const INITIAL_GESTURES: GestureState = { phase: "idle" };

export interface Recognized {
  readonly state: GestureState;
  readonly gestures: readonly Gesture[];
  /** Asks for a `timer` input at this time (the long-press deadline). */
  readonly timerAt?: number;
}

const IDLE: GestureState = INITIAL_GESTURES;

const result = (state: GestureState, ...gestures: readonly Gesture[]): Recognized => ({
  state,
  gestures,
});

const distance = (first: Point, second: Point): number =>
  Math.hypot(first.x - second.x, first.y - second.y);

const slopOf = (kind: PointerKind): number => (kind === "mouse" ? MOUSE_SLOP : TOUCH_SLOP);

const pinchOf = (fingers: readonly [Finger, Finger]): Pinch => {
  const [{ point: a }, { point: b }] = fingers;
  return {
    fingers,
    center: { x: (a.x + b.x) * HALF, y: (a.y + b.y) * HALF },
    spread: distance(a, b),
  };
};

/**
 * A first pointer: a secondary mouse button is an immediate context menu; a middle one pans; any
 * other button than these (back, forward) starts nothing.
 */
const startPress = (input: PointerEventInput): Recognized => {
  const middle = input.kind === "mouse" && input.button === MIDDLE_BUTTON;
  if (!middle && input.button !== PRIMARY_BUTTON && input.button !== SECONDARY_BUTTON) {
    return result(IDLE);
  }
  if (input.kind === "mouse" && input.button === SECONDARY_BUTTON) {
    return result(
      { phase: "secondary", id: input.id },
      { type: "contextMenu", point: input.point },
    );
  }
  const { id, kind, point, time: start } = input;
  const modifiers = middle ? { ...input.modifiers, space: true } : input.modifiers;
  const press = { id, kind, origin: point, point, start, modifiers, panOnly: middle };
  const recognized = result({ phase: "pressed", press });
  return kind === "mouse" ? recognized : { ...recognized, timerAt: start + LONG_PRESS_MS };
};

/** A second finger turns any one-finger gesture into a pinch; a drag in progress ends first. */
const startPinch = (state: GestureState, input: PointerEventInput): Recognized => {
  if (state.phase !== "pressed" && state.phase !== "longPressed" && state.phase !== "dragging") {
    return result(state);
  }
  const first = state.press.point;
  const pinch = pinchOf([
    { id: state.press.id, point: first },
    { id: input.id, point: input.point },
  ]);
  const started: Gesture = { type: "pinchStart", center: pinch.center };
  const next: GestureState = { phase: "pinching", pinch };
  return state.phase === "dragging"
    ? result(next, { type: "dragEnd", point: first }, started)
    : result(next, started);
};

const onDown = (state: GestureState, input: PointerEventInput): Recognized => {
  if (state.phase === "idle") {
    return startPress(input);
  }
  return input.kind === "mouse" ? result(state) : startPinch(state, input);
};

type Pressing = Extract<GestureState, { press: Press }>;

const pressMove = (state: Pressing, point: Point): Recognized => {
  const press = { ...state.press, point };
  if (state.phase === "dragging") {
    return result({ phase: "dragging", press }, { type: "dragMove", point });
  }
  if (distance(point, press.origin) <= slopOf(press.kind)) {
    return result({ phase: state.phase, press });
  }
  return result(
    { phase: "dragging", press },
    {
      type: "dragStart",
      origin: press.origin,
      point,
      kind: press.kind,
      modifiers: press.modifiers,
      afterLongPress: state.phase === "longPressed",
    },
  );
};

const pinchMove = (pinch: Pinch, id: number, point: Point): Recognized => {
  const [first, second] = pinch.fingers;
  if (first.id !== id && second.id !== id) {
    return result({ phase: "pinching", pinch });
  }
  const moved = (finger: Finger): Finger => (finger.id === id ? { id, point } : finger);
  const next = pinchOf([moved(first), moved(second)]);
  const scale = pinch.spread > 0 ? next.spread / pinch.spread : 1;
  const pan = { x: next.center.x - pinch.center.x, y: next.center.y - pinch.center.y };
  return result(
    { phase: "pinching", pinch: next },
    { type: "pinch", center: next.center, scale, pan },
  );
};

const onMove = (state: GestureState, input: PointerEventInput): Recognized => {
  switch (state.phase) {
    case "idle": {
      return input.kind === "mouse"
        ? result(state, { type: "hover", point: input.point })
        : result(state);
    }
    case "pressed":
    case "longPressed":
    case "dragging": {
      return state.press.id === input.id ? pressMove(state, input.point) : result(state);
    }
    case "pinching": {
      return pinchMove(state.pinch, input.id, input.point);
    }
    case "secondary":
    case "draining": {
      return result(state);
    }
    default: {
      return assertNever(state);
    }
  }
};

/** What lifting (or losing) the press's pointer means in each one-finger phase. */
const endPress = (state: Pressing, input: PointerEventInput): Recognized => {
  const cancelled = input.type === "cancel";
  if (state.phase === "dragging") {
    return result(
      IDLE,
      cancelled ? { type: "dragCancel" } : { type: "dragEnd", point: input.point },
    );
  }
  if (state.phase === "pressed" && !cancelled && !state.press.panOnly) {
    const { kind, modifiers } = state.press;
    return result(IDLE, { type: "tap", point: input.point, kind, modifiers });
  }
  return result(IDLE);
};

const endPinch = (pinch: Pinch, id: number): Recognized => {
  const left = pinch.fingers.filter((finger) => finger.id !== id).map((finger) => finger.id);
  return left.length === pinch.fingers.length
    ? result({ phase: "pinching", pinch })
    : result({ phase: "draining", ids: new Set(left) }, { type: "pinchEnd" });
};

const drain = (ids: ReadonlySet<number>, id: number): Recognized => {
  const left = new Set([...ids].filter((other) => other !== id));
  return result(left.size === 0 ? IDLE : { phase: "draining", ids: left });
};

const onUp = (state: GestureState, input: PointerEventInput): Recognized => {
  switch (state.phase) {
    case "pressed":
    case "longPressed":
    case "dragging": {
      return state.press.id === input.id ? endPress(state, input) : result(state);
    }
    case "secondary": {
      return result(state.id === input.id ? IDLE : state);
    }
    case "pinching": {
      return endPinch(state.pinch, input.id);
    }
    case "draining": {
      return drain(state.ids, input.id);
    }
    case "idle": {
      return result(state);
    }
    default: {
      return assertNever(state);
    }
  }
};

const onTimer = (state: GestureState, time: number): Recognized => {
  // A mouse never asks for the timer, but a stray one must not long-press it either.
  if (
    state.phase !== "pressed" ||
    state.press.kind === "mouse" ||
    time < state.press.start + LONG_PRESS_MS
  ) {
    return result(state);
  }
  const { press } = state;
  return result(
    { phase: "longPressed", press },
    { type: "longPress", point: press.origin, kind: press.kind },
  );
};

/**
 * The pointer state machine (spec §5.3, Phase 2 Task 6). Pure: time comes in on each input, and a
 * long-press deadline goes out as `timerAt`, which the adapter turns into a `timer` input.
 *
 * - Within slop and released: `tap`. Beyond slop: `dragStart`, `dragMove`…, `dragEnd`.
 * - Touch or pen held still for `LONG_PRESS_MS`: `longPress`; a later move gives a drag marked
 *   `afterLongPress`, and the release gives nothing more.
 * - A mouse's secondary button: `contextMenu` at once, and nothing else from that press.
 * - A mouse's middle button: a drag as if Space were held (so it pans); a click gives nothing.
 * - A second finger: `pinchStart` (after `dragEnd` if a drag was running), then `pinch`, then
 *   `pinchEnd` when either finger lifts; leftover fingers are ignored until lifted. A third is ignored.
 * - A mouse moving with no button down: `hover`; leaving the canvas then: `hoverEnd`. Touch never
 *   hovers.
 */
export const recognize = (state: GestureState, input: PointerInput): Recognized => {
  switch (input.type) {
    case "timer": {
      return onTimer(state, input.time);
    }
    case "down": {
      return onDown(state, input);
    }
    case "move": {
      return onMove(state, input);
    }
    case "up":
    case "cancel": {
      return onUp(state, input);
    }
    case "leave": {
      // Only a mouse hovers, and only while no button is down.
      return state.phase === "idle" && input.kind === "mouse"
        ? result(state, { type: "hoverEnd" })
        : result(state);
    }
    default: {
      return assertNever(input);
    }
  }
};
