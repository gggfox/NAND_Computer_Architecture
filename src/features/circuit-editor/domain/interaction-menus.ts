/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Point, WireColor } from "~/features/projects";
import type { WireId } from "~/shared/ids";

import { worldToScreen } from "./camera";
import { wireRoute } from "./geometry";
import { done, selected, withoutOverlays } from "./interaction";
import type {
  InteractionCommand,
  InteractionContext,
  InteractionState,
  Interpreted,
  Menu,
} from "./interaction";
import { arm } from "./interaction-wiring";
import { selectWire } from "./selection";

const HALF = 0.5;

export const withMenu = (result: Interpreted, menu: Menu): Interpreted => ({
  ...result,
  state: { ...result.state, menu },
});

/**
 * Long-press or right-click on a wire: its menu opens, and the wire is selected, unless it is
 * already part of a multi-selection the menu then acts on.
 */
export const openWireMenu = (
  state: InteractionState,
  wireId: WireId,
  screen: Point,
): Interpreted => {
  const { instances, wires } = state.selection;
  const inMany = wires.has(wireId) && instances.size + wires.size > 1;
  const base = inMany ? done(withoutOverlays(state)) : selected(state, selectWire(wireId));
  return withMenu(base, { kind: "wire", wireId, screen });
};

/** The canvas menu at `screen`; the selection stays. */
export const openCanvasMenu = (state: InteractionState, screen: Point): Interpreted =>
  done({ ...withoutOverlays(state), menu: { kind: "canvas", screen } });

const wireIn = (context: InteractionContext, wireId: WireId | undefined) =>
  context.scene.circuit.wires.find((wire) => wire.id === wireId);

/** Halfway along the middle segment of a route; `undefined` for a wire that is not drawn. */
const middleOf = (route: readonly Point[]): Point | undefined => {
  const at = Math.floor((route.length - 1) * HALF);
  const [from, to] = [route[at], route[at + 1]];
  return from && to && { x: (from.x + to.x) * HALF, y: (from.y + to.y) * HALF };
};

/**
 * `Enter` (or the menu key) with no chip selected: the wire menu of the first selected wire,
 * pointing at its middle, else the canvas menu at the viewport's centre.
 */
export const openMenuByKey = (
  state: InteractionState,
  context: InteractionContext,
): Interpreted => {
  const [wireId] = state.selection.wires;
  const wire = wireIn(context, wireId);
  const middle = wire === undefined ? undefined : middleOf(wireRoute(context.scene, wire));
  if (wire === undefined || middle === undefined) {
    const { width, height } = context.viewport;
    return openCanvasMenu(state, { x: width * HALF, y: height * HALF });
  }
  const screen = worldToScreen(state.camera, middle);
  return done({ ...withoutOverlays(state), menu: { kind: "wire", wireId: wire.id, screen } });
};

const recolorSelection = (
  state: InteractionState,
  color: WireColor | undefined,
  context: InteractionContext,
): Interpreted => {
  const wireIds = [...state.selection.wires];
  const closed = withoutOverlays(state);
  return wireIds.length === 0
    ? done(closed)
    : done(closed, {
        type: "dispatch",
        action: {
          type: "recolorWires",
          chipId: context.chipId,
          wireIds,
          ...(color === undefined ? {} : { color }),
        },
      });
};

const reroute = (
  state: InteractionState,
  wireIds: readonly WireId[],
  context: InteractionContext,
): Interpreted =>
  wireIds.length === 0
    ? done(withoutOverlays(state))
    : done(withoutOverlays(state), {
        type: "dispatch",
        action: { type: "rerouteWires", chipId: context.chipId, wireIds },
      });

/** Tidy wires: every automatic wire in the open chip, re-routed as one edit; hand bends stay. */
const tidy = (state: InteractionState, context: InteractionContext): Interpreted =>
  reroute(
    state,
    context.scene.circuit.wires.filter((wire) => !wire.manualWaypoints).map((wire) => wire.id),
    context,
  );

/** Branch: arms the wire's source (with its bit) in the wire's colour. */
const branch = (state: InteractionState, wireId: WireId, context: InteractionContext) => {
  const wire = wireIn(context, wireId);
  return wire === undefined
    ? done(withoutOverlays(state))
    : arm(withoutOverlays(state), { end: wire.from, color: wire.color }, context);
};

const editBends = (state: InteractionState, wireId: WireId, context: InteractionContext) =>
  done(
    wireIn(context, wireId) === undefined
      ? withoutOverlays(state)
      : { ...withoutOverlays(state), bends: wireId },
  );

type Of<Type extends InteractionCommand["type"]> = Extract<InteractionCommand, { type: Type }>;

type MenuHandlers = {
  readonly [Type in "recolorSelection" | "rerouteWire" | "tidyWires" | "branch" | "editBends"]: (
    state: InteractionState,
    command: Of<Type>,
    context: InteractionContext,
  ) => Interpreted;
};

/** The wire and canvas menu commands, for the command table. */
export const MENU_COMMANDS: MenuHandlers = {
  recolorSelection: (state, command, context) => recolorSelection(state, command.color, context),
  rerouteWire: (state, command, context) => reroute(state, [command.wireId], context),
  tidyWires: (state, _command, context) => tidy(state, context),
  branch: (state, command, context) => branch(state, command.wireId, context),
  editBends: (state, command, context) => editBends(state, command.wireId, context),
};
