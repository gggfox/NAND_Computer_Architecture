/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Point } from "~/features/projects";

import { screenToWorld, worldToScreen } from "./camera";
import { copyOf, pastedFrom } from "./clipboard";
import { GRID } from "./geometry";
import type { Rect } from "./geometry";
import { done, selected, withoutOverlays } from "./interaction";
import type {
  InteractionCommand,
  InteractionContext,
  InteractionState,
  Interpreted,
} from "./interaction";
import { DUPLICATE_COMMANDS } from "./interaction-duplicate";
import { snap } from "./move";
import { piecesBounds } from "./pieces-bounds";
import { EMPTY_SELECTION } from "./selection";
import type { Clipboard } from "./selection";

const HALF = 0.5;

const centreOf = (rect: Rect): Point => ({
  x: rect.x + rect.width * HALF,
  y: rect.y + rect.height * HALF,
});

/** Where the clipboard's parts sit when moved by `delta`, in world units. */
const boundsAt = (
  clipboard: Clipboard,
  delta: Point,
  context: InteractionContext,
): Rect | undefined => piecesBounds(context.scene, clipboard.instances, delta);

const inView = (state: InteractionState, rect: Rect, context: InteractionContext): boolean => {
  const topLeft = worldToScreen(state.camera, rect);
  const bottomRight = worldToScreen(state.camera, {
    x: rect.x + rect.width,
    y: rect.y + rect.height,
  });
  const { width, height } = context.viewport;
  return topLeft.x >= 0 && topLeft.y >= 0 && bottomRight.x <= width && bottomRight.y <= height;
};

/**
 * How far a paste moves the clipboard: `offset` grid steps down and right of the originals, or onto
 * the middle of the view when that spot is off screen (or in another chip).
 */
const pasteDelta = (
  state: InteractionState,
  clipboard: Clipboard,
  context: InteractionContext,
): Point => {
  const step = clipboard.offset * GRID;
  const stepped = { x: step, y: step };
  const bounds = boundsAt(clipboard, stepped, context);
  if (bounds === undefined || inView(state, bounds, context)) {
    return stepped;
  }
  const { width, height } = context.viewport;
  const middle = screenToWorld(state.camera, { x: width * HALF, y: height * HALF });
  const centre = centreOf(bounds);
  return snap({ x: stepped.x + middle.x - centre.x, y: stepped.y + middle.y - centre.y });
};

/** Ctrl+C: copies the selected parts and pins and the wires between them; a paste lands a step away. */
const copy = (state: InteractionState, context: InteractionContext): Interpreted => {
  const clipboard = copyOf(context.scene.circuit, state.selection, 1);
  if (clipboard === undefined) {
    return done(state);
  }
  return done(
    { ...state, clipboard },
    {
      type: "announce",
      announcement: { type: "clipboard", did: "copy", count: clipboard.instances.length },
    },
  );
};

/** Ctrl+X: copies, then deletes what was copied; the first paste puts it back where it was. */
const cut = (state: InteractionState, context: InteractionContext): Interpreted => {
  const clipboard = copyOf(context.scene.circuit, state.selection, 0);
  if (clipboard === undefined) {
    return done(state);
  }
  const action = {
    type: "removeItems",
    chipId: context.chipId,
    instanceIds: clipboard.instances.map((item) => item.id),
    wireIds: [],
  } as const;
  const { pinPick: _pinPick, ...open } = withoutOverlays(state);
  return done(
    { ...open, selection: EMPTY_SELECTION, clipboard },
    { type: "dispatch", action },
    {
      type: "announce",
      announcement: { type: "clipboard", did: "cut", count: clipboard.instances.length },
    },
  );
};

/** Ctrl+V: adds a fresh copy of the clipboard as one undo step, and selects it. */
const paste = (state: InteractionState, context: InteractionContext): Interpreted => {
  const { clipboard } = state;
  if (clipboard === undefined) {
    return done(state);
  }
  const delta = pasteDelta(state, clipboard, context);
  const { instances, pins, wires } = pastedFrom(clipboard, {
    delta,
    target: context.scene.circuit,
    newWireId: context.newWireId,
  });
  const selection = {
    instances: new Set(instances.map((item) => item.id)),
    wires: new Set(wires.map((item) => item.id)),
    pins: [],
  };
  const result = selected(
    { ...state, clipboard: { ...clipboard, offset: clipboard.offset + 1 } },
    selection,
    instances[0]?.id,
  );
  return done(
    result.state,
    {
      type: "dispatch",
      action: { type: "pasteItems", chipId: context.chipId, instances, pins, wires },
    },
    {
      type: "announce",
      announcement: { type: "clipboard", did: "paste", count: instances.length },
    },
  );
};

type ClipboardHandlers = {
  readonly [Type in "copy" | "cut" | "paste"]: (
    state: InteractionState,
    command: Extract<InteractionCommand, { type: Type }>,
    context: InteractionContext,
  ) => Interpreted;
};

/** The clipboard commands, with duplicate and array, for the command table. */
export const CLIPBOARD_COMMANDS: ClipboardHandlers & typeof DUPLICATE_COMMANDS = {
  ...DUPLICATE_COMMANDS,
  copy: (state, _command, context) => copy(state, context),
  cut: (state, _command, context) => cut(state, context),
  paste: (state, _command, context) => paste(state, context),
};
