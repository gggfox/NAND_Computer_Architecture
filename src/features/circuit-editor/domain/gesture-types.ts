import type { Point } from "~/features/projects";

export type PointerKind = "mouse" | "touch" | "pen";

export interface Modifiers {
  readonly shift: boolean;
  readonly alt: boolean;
  readonly ctrlOrMeta: boolean;
  /** Space held: a drag pans whatever the tool (spec §5.3). */
  readonly space: boolean;
}

export interface PointerEventInput {
  /** `leave`: the pointer left the canvas (a hovering mouse's hover ends). */
  readonly type: "down" | "move" | "up" | "cancel" | "leave";
  readonly id: number;
  readonly kind: PointerKind;
  /** 0 primary, 2 secondary; only read on `down`. */
  readonly button: number;
  /** Screen (CSS px) coordinates relative to the canvas. */
  readonly point: Point;
  readonly time: number;
  readonly modifiers: Modifiers;
}

/** A pointer event, or the timer the recognizer asked for with `timerAt`. */
export type PointerInput = PointerEventInput | { readonly type: "timer"; readonly time: number };

export type Gesture =
  | { readonly type: "hover"; readonly point: Point }
  /** A hovering mouse left the canvas. */
  | { readonly type: "hoverEnd" }
  | {
      readonly type: "tap";
      readonly point: Point;
      readonly kind: PointerKind;
      readonly modifiers: Modifiers;
    }
  | { readonly type: "longPress"; readonly point: Point; readonly kind: PointerKind }
  | { readonly type: "contextMenu"; readonly point: Point }
  | {
      readonly type: "dragStart";
      readonly origin: Point;
      readonly point: Point;
      readonly kind: PointerKind;
      readonly modifiers: Modifiers;
      readonly afterLongPress: boolean;
    }
  | { readonly type: "dragMove"; readonly point: Point }
  | { readonly type: "dragEnd"; readonly point: Point }
  | { readonly type: "dragCancel" }
  | { readonly type: "pinchStart"; readonly center: Point }
  /** `scale` and `pan` (screen px) are since the previous pinch event. */
  | { readonly type: "pinch"; readonly center: Point; readonly scale: number; readonly pan: Point }
  | { readonly type: "pinchEnd" };
