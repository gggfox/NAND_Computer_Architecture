/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { checkConnection } from "~/features/projects";
import type { Point } from "~/features/projects";
import type { WireId } from "~/shared/ids";

import { centreOn, worldToScreen } from "./camera";
import { segmentDistance } from "./geometry";
import type { Scene } from "./geometry";
import type { Gesture } from "./gesture-types";
import { ghostsOf } from "./ghost-routes";
import { done, withoutOverlays } from "./interaction";
import type {
  Announcement,
  Effect,
  InteractionContext,
  InteractionState,
  Interpreted,
} from "./interaction";
import { hitAt, toWorld } from "./interaction-hits";
import type { Ghost, SuggestCommand, Suggestions } from "./selection";
import { suggestWires } from "./suggest-wires";

/** A ghost's reach, like a wire's: half a 24 px target (D11). */
const REACH_PX = 12;
const HALF = 0.5;
const SETTLED = { type: "cameraSettled" } as const;

const announce = (announcement: Announcement): Effect => ({ type: "announce", announcement });

const withoutSuggestions = (state: InteractionState): InteractionState => {
  const { suggestions: _suggestions, ...rest } = state;
  return rest;
};

/** Suggest wires: shows ghosts for the selected chips, else the whole chip (D2, D15). Applies nothing. */
const suggest = (state: InteractionState, context: InteractionContext): Interpreted => {
  const { armed: _armed, bitPick: _pick, placing: _placing, ...rest } = withoutOverlays(state);
  const { instances } = state.selection;
  const scope = instances.size === 0 ? undefined : instances;
  const ghosts = ghostsOf(context.scene, suggestWires(context.scene, scope));
  const shown = withoutSuggestions(rest);
  return done(
    ghosts.length === 0 ? shown : { ...shown, suggestions: { ghosts } },
    announce({ type: "suggested", count: ghosts.length }),
  );
};

/** Where the focus sits once ghost `accepted` is gone, among `count` left: the same ghost, or the next. */
const focusAfter = (focus: number | undefined, accepted: number, count: number) =>
  focus === undefined ? {} : { focus: (focus > accepted ? focus - 1 : focus) % count };

/** The wires an accept dispatches, in `state.wireColor`. */
const connectEffect = (
  state: InteractionState,
  chosen: readonly Ghost[],
  context: InteractionContext,
): { readonly effect: Effect; readonly ids: readonly WireId[] } => {
  const wires = chosen.map(({ from, to }) => ({ wireId: context.newWireId(), from, to }));
  const color = state.wireColor === undefined ? {} : { color: state.wireColor };
  return {
    ids: wires.map((item) => item.wireId),
    effect: {
      type: "dispatch",
      action: { type: "connectWires", chipId: context.chipId, wires, ...color },
    },
  };
};

/**
 * Accepts the ghosts at `picks` as one `connectWires` (one undo step). The others stay, and
 * `accepting` marks the new wires so the history step keeps them (D10).
 */
const accept = (
  state: InteractionState,
  { suggestions, picks }: { readonly suggestions: Suggestions; readonly picks: readonly number[] },
  context: InteractionContext,
): Interpreted => {
  const { ghosts, focus } = suggestions;
  const chosen = ghosts.filter((_ghost, index) => picks.includes(index));
  const left = ghosts.filter((_ghost, index) => !picks.includes(index));
  const { effect, ids } = connectEffect(state, chosen, context);
  const [first = 0] = picks;
  const next =
    left.length === 0
      ? withoutSuggestions(state)
      : {
          ...state,
          suggestions: { ghosts: left, accepting: ids, ...focusAfter(focus, first, left.length) },
        };
  return done(next, effect, announce({ type: "accepted", count: chosen.length }));
};

const acceptOne = (
  state: InteractionState,
  command: Extract<SuggestCommand, { type: "acceptGhost" }>,
  context: InteractionContext,
): Interpreted => {
  const { suggestions } = state;
  const index = command.index ?? suggestions?.focus;
  return suggestions === undefined || index === undefined || suggestions.ghosts[index] === undefined
    ? done(state)
    : accept(state, { suggestions, picks: [index] }, context);
};

const acceptAll = (state: InteractionState, context: InteractionContext): Interpreted => {
  const { suggestions } = state;
  return suggestions === undefined
    ? done(state)
    : accept(
        state,
        { suggestions, picks: suggestions.ghosts.map((_ghost, index) => index) },
        context,
      );
};

/** Escape's ghost step, and Dismiss: the ghosts go and nothing is applied; `undefined` when none show. */
export const dismissGhosts = (state: InteractionState): Interpreted | undefined =>
  state.suggestions === undefined
    ? undefined
    : done(withoutSuggestions(state), announce({ type: "dismissed" }));

/** The middle of a route: its middle vertex, or the middle of its middle segment. */
const midpoint = (route: readonly Point[]): Point | undefined => {
  const first = route[Math.floor((route.length - 1) * HALF)];
  const second = route[Math.ceil((route.length - 1) * HALF)];
  return first === undefined || second === undefined
    ? undefined
    : { x: (first.x + second.x) * HALF, y: (first.y + second.y) * HALF };
};

/** Centres the camera on a ghost that is off screen, so focus never leaves the view. */
const revealed = (
  { state, effects }: Interpreted,
  ghost: Ghost,
  context: InteractionContext,
): Interpreted => {
  const middle = midpoint(ghost.route);
  if (middle === undefined) {
    return { state, effects };
  }
  const at = worldToScreen(state.camera, middle);
  const { width, height } = context.viewport;
  if (at.x >= 0 && at.y >= 0 && at.x <= width && at.y <= height) {
    return { state, effects };
  }
  const camera = centreOn(state.camera, middle, context.viewport);
  return { state: { ...state, camera }, effects: [...effects, SETTLED] };
};

/** `n` / `N` while ghosts show: focuses the next or previous one, wrapping (D12). */
const nextGhost = (
  state: InteractionState,
  backwards: boolean,
  context: InteractionContext,
): Interpreted => {
  const { suggestions } = state;
  const count = suggestions?.ghosts.length ?? 0;
  if (suggestions === undefined || count === 0) {
    return done(state);
  }
  const at = suggestions.focus ?? (backwards ? 0 : -1);
  const index = (at + (backwards ? -1 : 1) + count) % count;
  const ghost = suggestions.ghosts[index];
  return ghost === undefined
    ? done(state)
    : revealed(
        done(
          { ...state, suggestions: { ...suggestions, focus: index } },
          announce({ type: "ghostFocused", index, count, ghost }),
        ),
        ghost,
        context,
      );
};

/** How far `point` is from the nearest part of a route. */
const awayFrom = (route: readonly Point[], point: Point): number =>
  route.reduce((best, to, index) => {
    const from = route[index - 1];
    return from === undefined ? best : Math.min(best, segmentDistance(point, from, to));
  }, Infinity);

/**
 * A tap on a ghost accepts it. A pin under the tap wins, so tapping a ghost's end pin works as
 * before (D11); `undefined` when the tap is not on a ghost.
 */
export const ghostTap = (
  state: InteractionState,
  gesture: Gesture,
  context: InteractionContext,
): Interpreted | undefined => {
  const { suggestions } = state;
  if (gesture.type !== "tap" || suggestions === undefined) {
    return undefined;
  }
  if (hitAt(state, context, gesture.point).type === "pin") {
    return undefined;
  }
  const world = toWorld(state, gesture.point);
  const reach = REACH_PX / state.camera.zoom;
  const [nearest] = suggestions.ghosts
    .map((ghost, index) => ({ index, away: awayFrom(ghost.route, world) }))
    .filter(({ away }) => away <= reach)
    .toSorted((first, second) => first.away - second.away);
  return nearest === undefined
    ? undefined
    : accept(state, { suggestions, picks: [nearest.index] }, context);
};

/**
 * The ghosts after an edit: only an edit that added the accepted wires keeps the rest, each
 * re-checked against the new circuit (D10); any other edit, undo or redo clears them.
 */
export const suggestionsAfter = (
  suggestions: Suggestions | undefined,
  scene: Scene,
): Suggestions | undefined => {
  const accepting = suggestions?.accepting;
  if (suggestions === undefined || accepting === undefined) {
    return undefined;
  }
  const present = new Set(scene.circuit.wires.map((item) => item.id));
  if (!accepting.every((id) => present.has(id))) {
    return undefined;
  }
  const legal = suggestions.ghosts.map(
    ({ from, to }) => checkConnection(scene.project, scene.circuit, from, to).ok,
  );
  const ghosts = suggestions.ghosts.filter((_ghost, index) => legal[index] === true);
  const before = legal.slice(0, suggestions.focus).filter(Boolean).length;
  return ghosts.length === 0
    ? undefined
    : {
        ghosts,
        ...(suggestions.focus === undefined ? {} : { focus: Math.min(before, ghosts.length - 1) }),
      };
};

type SuggestHandlers = {
  readonly [Type in SuggestCommand["type"]]: (
    state: InteractionState,
    command: Extract<SuggestCommand, { type: Type }>,
    context: InteractionContext,
  ) => Interpreted;
};

/** The suggestion commands, for the wiring command table. Only the accepts dispatch. */
export const SUGGEST_COMMANDS: SuggestHandlers = {
  suggestWires: (state, _command, context) => suggest(state, context),
  acceptGhost: acceptOne,
  acceptAllGhosts: (state, _command, context) => acceptAll(state, context),
  dismissGhosts: (state) => dismissGhosts(state) ?? done(state),
  nextGhost: (state, command, context) => nextGhost(state, command.backwards, context),
};
