import { bendHandles } from "./bend-geometry";
import { PIN_CELL } from "./chip-layout";
import { done } from "./interaction";
import type {
  Bends,
  InteractionCommand,
  InteractionContext,
  InteractionState,
  Interpreted,
} from "./interaction";
import { leaveBends, segmentEdit } from "./interaction-bends";

type Nudge = Extract<InteractionCommand, { type: "nudge" }>;

/** `]` / `[` in bend mode: the next or previous interior segment, wrapping. */
const stepSegment = (
  state: InteractionState,
  { bends, forward }: { readonly bends: Bends; readonly forward: boolean },
  context: InteractionContext,
): Interpreted => {
  const handles = bendHandles(context.scene, bends.wireId);
  const at = handles.findIndex((handle) => handle.index === bends.segment);
  const next = handles.at((at + (forward ? 1 : -1) + handles.length) % handles.length);
  return next === undefined
    ? done(state)
    : done({ ...state, bends: { ...bends, segment: next.index } });
};

/**
 * An arrow in bend mode moves the focused segment across itself, one `PIN_CELL` a step (Shift's
 * bigger step is four), as one `moveWaypoint`; an arrow along the segment does nothing.
 */
const moveFocused = (
  state: InteractionState,
  { bends, nudge }: { readonly bends: Bends; readonly nudge: Nudge },
  context: InteractionContext,
): Interpreted => {
  const handle = bendHandles(context.scene, bends.wireId).find(
    (item) => item.index === bends.segment,
  );
  const steps = handle?.axis === "x" ? nudge.columns : nudge.rows;
  return handle === undefined || steps === 0
    ? done(state)
    : done(
        state,
        ...segmentEdit(context, bends.wireId, { index: handle.index, offset: steps * PIN_CELL }),
      );
};

/** Escape leaves bend mode only once nothing above it (wiring, a menu or card) is open. */
const blocksEscape = (state: InteractionState): boolean =>
  state.bitPick !== undefined ||
  state.armed !== undefined ||
  state.menu !== undefined ||
  state.card !== undefined;

/**
 * The keys bend mode takes over: `]` / `[` step the focused segment (the chip selection stays),
 * arrows move it, and Escape leaves. `undefined` for every other command, or outside bend mode.
 */
export const bendKey = (
  state: InteractionState,
  command: InteractionCommand,
  context: InteractionContext,
): Interpreted | undefined => {
  const { bends } = state;
  if (bends === undefined) {
    return undefined;
  }
  if (command.type === "selectNext" || command.type === "selectPrevious") {
    return stepSegment(state, { bends, forward: command.type === "selectNext" }, context);
  }
  if (command.type === "nudge") {
    return moveFocused(state, { bends, nudge: command }, context);
  }
  return command.type === "escape" && !blocksEscape(state) ? leaveBends(state) : undefined;
};
