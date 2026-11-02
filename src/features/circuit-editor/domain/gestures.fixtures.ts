/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Gesture, GestureState, Modifiers, PointerInput, PointerKind } from "./gesture-types";
import { INITIAL_GESTURES, recognize } from "./gestures";

export const NONE: Modifiers = { shift: false, alt: false, ctrlOrMeta: false, space: false };

interface At {
  readonly x?: number;
  readonly y?: number;
  readonly id?: number;
  readonly kind?: PointerKind;
  readonly time?: number;
  readonly button?: number;
  readonly modifiers?: Modifiers;
}

const pointer =
  (type: "down" | "move" | "up" | "cancel" | "leave") =>
  ({
    x = 0,
    y = 0,
    id = 1,
    kind = "touch",
    time = 0,
    button = 0,
    modifiers = NONE,
  }: At = {}): PointerInput => ({
    type,
    id,
    kind,
    button,
    point: { x, y },
    time,
    modifiers,
  });

export const down = pointer("down");
export const move = pointer("move");
export const up = pointer("up");
export const cancel = pointer("cancel");
export const leave = pointer("leave");
export const timer = (time: number): PointerInput => ({ type: "timer", time });

interface Run {
  readonly state: GestureState;
  readonly gestures: readonly Gesture[];
  readonly timers: readonly number[];
}

export const run = (inputs: readonly PointerInput[], from: GestureState = INITIAL_GESTURES): Run =>
  inputs.reduce<Run>(
    (acc, input) => {
      const next = recognize(acc.state, input);
      return {
        state: next.state,
        gestures: [...acc.gestures, ...next.gestures],
        timers: next.timerAt === undefined ? acc.timers : [...acc.timers, next.timerAt],
      };
    },
    { state: from, gestures: [], timers: [] },
  );

export const types = (inputs: readonly PointerInput[]): readonly string[] =>
  run(inputs).gestures.map((gesture) => gesture.type);
