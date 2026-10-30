import { assertNever } from "~/shared/assert-never";

import { afterHistory, done } from "./interaction";
import type {
  InteractionContext,
  InteractionInput,
  InteractionState,
  Interpreted,
} from "./interaction";
import { onCommand } from "./interaction-commands";
import { onGesture } from "./interaction-gestures";

/**
 * The canvas state machine (spec §5.1, §5.3, §5.8): gestures and commands in, a new interaction
 * state and effects out. Every edit leaves as one `dispatch` effect, so a drag is one undo step
 * and nothing is dispatched until it ends.
 */
export const interact = (
  state: InteractionState,
  input: InteractionInput,
  context: InteractionContext,
): Interpreted => {
  switch (input.type) {
    case "gesture": {
      return onGesture(state, input.gesture, context);
    }
    case "command": {
      return onCommand(state, input.command, context);
    }
    case "historyChanged": {
      return done(afterHistory(state, context.scene.circuit));
    }
    default: {
      return assertNever(input);
    }
  }
};
