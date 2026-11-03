/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Point } from "~/features/projects";

import { arrayDeltas } from "./array";
import type { ArrayRequest } from "./array";
import { copiesOf, copyOf } from "./clipboard";
import { GRID } from "./geometry";
import { done, selected, withoutOverlays } from "./interaction";
import type {
  InteractionCommand,
  InteractionContext,
  InteractionState,
  Interpreted,
} from "./interaction";
import { piecesBounds } from "./pieces-bounds";
import { EMPTY_SELECTION } from "./selection";
import type { Clipboard, ClipboardDid, Selection } from "./selection";

const ONE_STEP: readonly Point[] = [{ x: GRID, y: GRID }];

type Copies = Omit<Clipboard, "offset">;

interface Added {
  readonly copies: Copies;
  readonly did: ClipboardDid;
  readonly keep: Selection;
}

/**
 * Adds `copies` as one edit and selects them along with `keep`; `did` says
 * which command it was.
 */
const added = (
  state: InteractionState,
  context: InteractionContext,
  { copies, did, keep }: Added,
): Interpreted => {
  const { instances, pins, wires } = copies;
  const selection = {
    instances: new Set([...keep.instances, ...instances.map((item) => item.id)]),
    wires: new Set([...keep.wires, ...wires.map((item) => item.id)]),
    pins: [],
  };
  const { arraying: _arraying, ...open } = state;
  const result = selected(open, selection, instances[0]?.id);
  return done(
    result.state,
    {
      type: "dispatch",
      action: { type: "pasteItems", chipId: context.chipId, instances, pins, wires },
    },
    { type: "announce", announcement: { type: "clipboard", did, count: instances.length } },
  );
};

/** Ctrl+D: a copy of the selected parts one grid step down and right; the clipboard is untouched. */
const duplicate = (state: InteractionState, context: InteractionContext): Interpreted => {
  const source = copyOf(context.scene.circuit, state.selection, 1);
  if (source === undefined) {
    return done(state);
  }
  const copies = copiesOf(source, ONE_STEP, {
    target: context.scene.circuit,
    newWireId: context.newWireId,
  });
  return added(state, context, { copies, did: "duplicate", keep: EMPTY_SELECTION });
};

/** Ctrl+Shift+D: opens the Array dialog, when there is something to repeat. */
const showArray = (state: InteractionState): Interpreted =>
  state.selection.instances.size === 0
    ? done(state)
    : done({ ...withoutOverlays(state), arraying: true });

const hideArray = (state: InteractionState): Interpreted => {
  const { arraying: _arraying, ...rest } = state;
  return done(rest);
};

/** The Array dialog's submit: `request.count` copies laid out from the selection, as one edit. */
const array = (
  state: InteractionState,
  request: ArrayRequest,
  context: InteractionContext,
): Interpreted => {
  const source = copyOf(context.scene.circuit, state.selection, 1);
  const bounds = source && piecesBounds(context.scene, source.instances);
  if (source === undefined || bounds === undefined) {
    return hideArray(state);
  }
  const copies = copiesOf(source, arrayDeltas(request, bounds), {
    target: context.scene.circuit,
    newWireId: context.newWireId,
  });
  return added(state, context, { copies, did: "array", keep: state.selection });
};

type DuplicateHandlers = {
  readonly [Type in "duplicate" | "showArray" | "hideArray" | "array"]: (
    state: InteractionState,
    command: Extract<InteractionCommand, { type: Type }>,
    context: InteractionContext,
  ) => Interpreted;
};

/** The duplicate and array commands, for the command table. */
export const DUPLICATE_COMMANDS: DuplicateHandlers = {
  duplicate: (state, _command, context) => duplicate(state, context),
  showArray: (state) => showArray(state),
  hideArray: (state) => hideArray(state),
  array: (state, command, context) => array(state, command.request, context),
};
