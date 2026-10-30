/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Point } from "~/features/projects";

import type { Gesture, Modifiers, PointerInput, PointerKind } from "../domain/gesture-types";
import { INITIAL_GESTURES, recognize } from "../domain/gestures";
import type { InteractionCommand } from "../domain/interaction";

export interface PointerInputOptions {
  readonly onGesture: (gesture: Gesture) => void;
  /** Wheel and trackpad input, already turned into camera commands. */
  readonly onWheel: (command: InteractionCommand) => void;
  /** Whether Space is held: the canvas host tracks it, since it has keyboard focus. */
  readonly isSpaceDown: () => boolean;
}

/**
 * Touches starting this close to the left or right edge are left to the system (iOS and
 * Android use edge swipes for "back"); confirmed on devices in the Phase 2 spike.
 */
const EDGE_GUARD_PX = 16;
/** A wheel "line" in pixels, for mice that report lines (Firefox). */
const LINE_PX = 16;
const DOM_DELTA_LINE = 1;
/**
 * Wheel zoom sensitivity: e^(-deltaY / 500), so a 100 px mouse notch is about ±20% and a
 * trackpad pinch's small deltas zoom smoothly.
 */
const PIXELS_PER_E = 500;

const kindOf = (event: PointerEvent): PointerKind => {
  if (event.pointerType === "touch" || event.pointerType === "pen") {
    return event.pointerType;
  }
  return "mouse";
};

const pointIn = (element: HTMLElement, event: MouseEvent): Point => {
  const rect = element.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
};

const modifiersOf = (event: MouseEvent, space: boolean): Modifiers => ({
  shift: event.shiftKey,
  alt: event.altKey,
  ctrlOrMeta: event.ctrlKey || event.metaKey,
  space,
});

/** The last of a move's coalesced events: the pointer's newest position this frame. */
const latest = (event: PointerEvent): PointerEvent => event.getCoalescedEvents?.().at(-1) ?? event;

const nearEdge = (element: HTMLElement, event: PointerEvent): boolean => {
  if (kindOf(event) === "mouse") {
    return false;
  }
  const { x } = pointIn(element, event);
  return x < EDGE_GUARD_PX || x > element.clientWidth - EDGE_GUARD_PX;
};

/** Wheel: Ctrl/⌘ (and trackpad pinch) zooms at the pointer; otherwise it pans, Shift sideways. */
const wheelCommand = (element: HTMLElement, event: WheelEvent): InteractionCommand => {
  const scale = event.deltaMode === DOM_DELTA_LINE ? LINE_PX : 1;
  const [dx, dy] = [event.deltaX * scale, event.deltaY * scale];
  if (event.ctrlKey || event.metaKey) {
    return {
      type: "zoomBy",
      screen: pointIn(element, event),
      factor: Math.exp(-dy / PIXELS_PER_E),
    };
  }
  return { type: "panBy", delta: event.shiftKey ? { x: -dy, y: 0 } : { x: -dx, y: -dy } };
};

const preventContextMenu = (event: Event): void => {
  event.preventDefault();
};

/** Runs the recognizer, emits its gestures and keeps the one long-press timer it asks for. */
const createFeeder = (options: PointerInputOptions) => {
  let state = INITIAL_GESTURES;
  const timer: { id?: ReturnType<typeof setTimeout> } = {};
  const feed = (input: PointerInput): void => {
    const result = recognize(state, input);
    ({ state } = result);
    for (const gesture of result.gestures) {
      options.onGesture(gesture);
    }
    if (result.timerAt !== undefined) {
      clearTimeout(timer.id);
      timer.id = setTimeout(() => {
        feed({ type: "timer", time: performance.now() });
      }, result.timerAt - performance.now());
    }
  };
  return {
    feed,
    stop: () => {
      clearTimeout(timer.id);
    },
  };
};

type Listeners = Readonly<Record<string, (event: Event) => void>>;

const listenersFor = (
  element: HTMLElement,
  options: PointerInputOptions,
  feed: (input: PointerInput) => void,
): Listeners => {
  const pointer =
    (type: "down" | "move" | "up" | "cancel") =>
    (event: Event): void => {
      if (!(event instanceof PointerEvent)) {
        return;
      }
      if (type === "down") {
        if (nearEdge(element, event)) {
          return;
        }
        element.setPointerCapture(event.pointerId);
      }
      const source = type === "move" ? latest(event) : event;
      feed({
        type,
        id: event.pointerId,
        kind: kindOf(event),
        button: event.button,
        point: pointIn(element, source),
        time: event.timeStamp,
        modifiers: modifiersOf(event, options.isSpaceDown()),
      });
    };
  return {
    pointerdown: pointer("down"),
    pointermove: pointer("move"),
    pointerup: pointer("up"),
    pointercancel: pointer("cancel"),
    // Fires after `pointerup` too; the recognizer ignores pointers it no longer tracks.
    lostpointercapture: pointer("cancel"),
    contextmenu: preventContextMenu,
    wheel: (event) => {
      if (event instanceof WheelEvent) {
        event.preventDefault();
        options.onWheel(wheelCommand(element, event));
      }
    },
  };
};

/**
 * Feeds DOM pointer and wheel events on `element` through the gesture recognizer (ADR 20: no
 * React in the loop). Pointers are captured on down, so a drag keeps reporting outside the
 * element; the long-press timer the recognizer asks for is run here. Returns the detach function.
 */
export const attachPointerInput = (
  element: HTMLElement,
  options: PointerInputOptions,
): (() => void) => {
  const feeder = createFeeder(options);
  const listeners = Object.entries(listenersFor(element, options, feeder.feed));
  for (const [type, listener] of listeners) {
    element.addEventListener(type, listener, { passive: false });
  }
  return () => {
    feeder.stop();
    for (const [type, listener] of listeners) {
      element.removeEventListener(type, listener);
    }
  };
};
