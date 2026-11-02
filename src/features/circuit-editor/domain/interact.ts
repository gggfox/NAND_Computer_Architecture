import { assertNever } from "~/shared/assert-never";

import type { Gesture } from "./gesture-types";
import { done } from "./interaction";
import type {
  InteractionContext,
  InteractionInput,
  InteractionState,
  Interpreted,
} from "./interaction";
import { onCommand } from "./interaction-commands";
import { onGesture } from "./interaction-gestures";
import { afterHistory } from "./interaction-history";

/** Pointer movement alone leaves a refusal notice up; every other gesture or command clears it. */
const KEEPS_NOTICE: ReadonlySet<Gesture["type"]> = new Set(["hover", "hoverEnd"]);

const clearsNotice = (input: InteractionInput): boolean =>
  input.type === "command" || (input.type === "gesture" && !KEEPS_NOTICE.has(input.gesture.type));

/** The state without its notice when `input` clears it; the input that sets one adds it back. */
const noticeCleared = (state: InteractionState, input: InteractionInput): InteractionState => {
  if (state.notice === undefined || !clearsNotice(input)) {
    return state;
  }
  const { notice: _notice, ...rest } = state;
  return rest;
};

/**
 * The canvas state machine (spec §5.1, §5.3, §5.8): gestures and commands in, a new interaction
 * state and effects out. Every edit leaves as one `dispatch` effect, so a drag is one undo step
 * and nothing is dispatched until it ends.
 */
export const interact = (
  before: InteractionState,
  input: InteractionInput,
  context: InteractionContext,
): Interpreted => {
  const state = noticeCleared(before, input);
  switch (input.type) {
    case "gesture": {
      return onGesture(state, input.gesture, context);
    }
    case "command": {
      return onCommand(state, input.command, context);
    }
    case "historyChanged": {
      const after = afterHistory(state, context.scene);
      // Bend mode ended with its wire (deleted, or undone away), so say so, as Escape does.
      return state.bends !== undefined && after.bends === undefined
        ? done(after, { type: "announce", announcement: { type: "bends", active: false } })
        : done(after);
    }
    default: {
      return assertNever(input);
    }
  }
};
