/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { piece } from "~/features/projects";
import type { Point } from "~/features/projects";

import type { PlaceableKind } from "./actions";
import { screenToWorld } from "./camera";
import { done, withoutOverlays } from "./interaction";
import type {
  InteractionCommand,
  InteractionContext,
  InteractionState,
  Interpreted,
} from "./interaction";
import { CLIPBOARD_COMMANDS } from "./interaction-clipboard";
import { pinAt, placementPosition } from "./placement";

/** How many recently placed kinds the quick-add menu offers (D9). */
export const RECENT_LIMIT = 5;

const HALF = 0.5;

/** A part's identity: its type, plus the width or chip where it has one. */
const kindKey = (kind: PlaceableKind): string => {
  if (kind.type === "custom") {
    return `custom:${kind.chipId}`;
  }
  return "width" in kind ? `${kind.type}:${String(kind.width)}` : kind.type;
};

const sameKind = (first: PlaceableKind, second: PlaceableKind): boolean =>
  kindKey(first) === kindKey(second);

const withRecent = (recent: readonly PlaceableKind[], kind: PlaceableKind) =>
  [kind, ...recent.filter((other) => !sameKind(other, kind))].slice(0, RECENT_LIMIT);

/** The state with nothing armed for wiring: no armed pin and no bit picker. */
const withoutWiring = (state: InteractionState): InteractionState => {
  const { armed: _armed, bitPick: _bitPick, ...rest } = state;
  return rest;
};

/** Stops placing and says so. */
const stopped = (state: InteractionState): Interpreted => {
  const { placing: _placing, ...rest } = state;
  return done(rest, { type: "announce", announcement: { type: "placing", kind: undefined } });
};

/** Arms `kind` for placement, disarming a pin; the armed kind again cancels instead (D6). */
const armPlacement = (state: InteractionState, kind: PlaceableKind): Interpreted => {
  if (state.placing !== undefined && sameKind(state.placing, kind)) {
    return stopped(state);
  }
  return done(
    { ...withoutWiring(state), placing: kind },
    { type: "announce", announcement: { type: "placing", kind } },
  );
};

/** One `kind` centred on `screen`; armed placement stays armed. */
const placeAt = (
  state: InteractionState,
  { kind, screen }: { readonly kind: PlaceableKind; readonly screen: Point },
  context: InteractionContext,
): Interpreted => {
  const world = screenToWorld(state.camera, screen);
  const instance = piece(kind, placementPosition(context.scene, kind, world));
  return done(
    { ...withoutOverlays(state), recent: withRecent(state.recent, kind) },
    { type: "dispatch", action: { type: "placeChip", chipId: context.chipId, instance } },
    { type: "announce", announcement: { type: "placed", kind } },
  );
};

const viewportCentre = (context: InteractionContext): Point => ({
  x: context.viewport.width * HALF,
  y: context.viewport.height * HALF,
});

const addPinAt = (
  state: InteractionState,
  command: Extract<InteractionCommand, { type: "addPinAt" }>,
  context: InteractionContext,
): Interpreted => {
  const world = screenToWorld(state.camera, command.screen ?? viewportCentre(context));
  const added = pinAt(context.scene.circuit, command.direction, world);
  const { direction, name } = added.pin;
  return done(
    withoutOverlays(state),
    { type: "dispatch", action: { type: "addPins", chipId: context.chipId, pins: [added] } },
    { type: "announce", announcement: { type: "pinAdded", direction, name } },
  );
};

/** A tap while placing places a copy wherever it lands, even on a pin or a chip (D6). */
export const placingTap = (
  state: InteractionState,
  point: Point,
  context: InteractionContext,
): Interpreted | undefined =>
  state.placing === undefined
    ? undefined
    : placeAt(state, { kind: state.placing, screen: point }, context);

/** Escape's placement step: it stops placing, keeping the selection; else `undefined`. */
export const stopPlacing = (state: InteractionState): Interpreted | undefined =>
  state.placing === undefined ? undefined : stopped(state);

type Of<Type extends InteractionCommand["type"]> = Extract<InteractionCommand, { type: Type }>;

type PlaceHandlers = {
  readonly [Type in "armPlacement" | "cancelPlacement" | "placeAt" | "addPinAt"]: (
    state: InteractionState,
    command: Of<Type>,
    context: InteractionContext,
  ) => Interpreted;
};

/** The placement commands, and the clipboard's (a paste places parts too), for the command table. */
export const PLACE_COMMANDS: PlaceHandlers & typeof CLIPBOARD_COMMANDS = {
  ...CLIPBOARD_COMMANDS,
  armPlacement: (state, command) => armPlacement(state, command.kind),
  cancelPlacement: (state) => stopPlacing(state) ?? done(state),
  placeAt: (state, command, context) =>
    placeAt(
      state,
      { kind: command.kind, screen: command.screen ?? viewportCentre(context) },
      context,
    ),
  addPinAt,
};
