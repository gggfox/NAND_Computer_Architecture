/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Point } from "~/features/projects";

import { stepIntent } from "../domain/drag-intent";
import type { DragIntent, IntentEvent, IntentOutcome } from "../domain/drag-intent";

export interface PressHandlers {
  /** The press became a drag. */
  readonly onDragStart: (client: Point) => void;
  /** The drag moved. */
  readonly onDragMove: (client: Point) => void;
  /** The press ended: how, and where the pointer was last. */
  readonly onEnd: (outcome: IntentOutcome, client: Point) => void;
}

const IDLE: DragIntent = { phase: "idle" };

const pointerOf = (type: string): "mouse" | "pen" | "touch" => {
  if (type === "mouse" || type === "pen") {
    return type;
  }
  return "touch";
};

const clientOf = (event: PointerEvent): Point => ({ x: event.clientX, y: event.clientY });

type Listener = readonly [string, (event: Event) => void, AddEventListenerOptions];

const CAPTURE = { capture: true } as const;
const ACTIVE = { capture: true, passive: false } as const;

/** One press read through `stepIntent`, telling `handlers` when it drags and where. */
interface Press {
  readonly move: (client: Point) => void;
  /** Releases at `client`; the outcome. */
  readonly up: (client: Point) => IntentOutcome;
  readonly cancel: () => void;
  /** Steps the clock; whether the press is still waiting for a long-press. */
  readonly tick: () => boolean;
  /** Whether a held or dragging finger must keep the page from scrolling. */
  readonly holdsPage: () => boolean;
}

const startPress = (down: PointerEvent, handlers: PressHandlers): Press => {
  let last = clientOf(down);
  let { intent } = stepIntent(IDLE, {
    type: "down",
    pointer: pointerOf(down.pointerType),
    point: last,
    at: performance.now(),
  });
  const step = (event: IntentEvent): IntentOutcome => {
    const wasDragging = intent.phase === "dragging";
    const next = stepIntent(intent, event);
    ({ intent } = next);
    if (intent.phase === "dragging") {
      (wasDragging ? handlers.onDragMove : handlers.onDragStart)(last);
    }
    return next.outcome;
  };
  const tick = (): void => {
    step({ type: "tick", at: performance.now() });
  };
  return {
    move: (client) => {
      last = client;
      step({ type: "move", point: client, at: performance.now() });
    },
    up: (client) => {
      last = client;
      // A held press must not read as a tap because the frame tick was throttled.
      tick();
      return step({ type: "up" });
    },
    cancel: () => {
      step({ type: "cancel" });
    },
    tick: () => {
      tick();
      return intent.phase === "pressing";
    },
    holdsPage: () => intent.phase === "held" || intent.phase === "dragging",
  };
};

/**
 * Follows one press from its `pointerdown` (the spike's mechanism, D1): window listeners from down
 * to up or cancel, a frame tick while pressing, and the page kept from scrolling under a held or
 * dragging finger. Returns the stop, which removes everything without an outcome.
 */
export const trackPress = (down: PointerEvent, handlers: PressHandlers): (() => void) => {
  const press = startPress(down, handlers);
  let frame = 0;
  const onFrame = (): void => {
    frame = press.tick() ? requestAnimationFrame(onFrame) : 0;
  };
  const listeners = listenersFor({ down, press, handlers }, () => {
    stop();
  });
  function stop(): void {
    cancelAnimationFrame(frame);
    for (const [type, listener, options] of listeners) {
      globalThis.removeEventListener(type, listener, options);
    }
  }
  for (const [type, listener, options] of listeners) {
    globalThis.addEventListener(type, listener, options);
  }
  frame = requestAnimationFrame(onFrame);
  return stop;
};

interface Tracked {
  readonly down: PointerEvent;
  readonly press: Press;
  readonly handlers: PressHandlers;
}

/** The window listeners for one press; `stop` removes them before the press ends. */
const listenersFor = (
  { down, press, handlers }: Tracked,
  stop: () => void,
): readonly Listener[] => {
  const ours =
    (listen: (event: PointerEvent) => void) =>
    (event: Event): void => {
      if (event instanceof PointerEvent && event.pointerId === down.pointerId) {
        listen(event);
      }
    };
  return [
    [
      "pointermove",
      ours((event) => {
        press.move(clientOf(event));
      }),
      CAPTURE,
    ],
    [
      "pointerup",
      ours((event) => {
        stop();
        handlers.onEnd(press.up(clientOf(event)), clientOf(event));
      }),
      CAPTURE,
    ],
    [
      "pointercancel",
      ours((event) => {
        stop();
        press.cancel();
        handlers.onEnd("none", clientOf(event));
      }),
      CAPTURE,
    ],
    [
      "touchmove",
      (event) => {
        if (press.holdsPage()) {
          event.preventDefault();
        }
      },
      ACTIVE,
    ],
  ];
};
