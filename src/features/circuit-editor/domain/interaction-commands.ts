/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Point } from "~/features/projects";
import type { InstanceId } from "~/shared/ids";

import { boundsOf, centreOn, fitBounds, panBy, worldToScreen, zoomAt } from "./camera";
import { GRID, layoutIn } from "./geometry";
import type { Rect } from "./geometry";
import { done, selected, withoutOverlays } from "./interaction";
import type {
  InteractionCommand,
  InteractionContext,
  InteractionState,
  Interpreted,
} from "./interaction";
import { bendKey } from "./interaction-bend-keys";
import { MENU_COMMANDS, openMenuByKey } from "./interaction-menus";
import { PIN_COMMANDS } from "./interaction-pins";
import { cancelWiring, WIRING_COMMANDS } from "./interaction-wiring";
import {
  addInstances,
  EMPTY_SELECTION,
  isEmpty,
  selectInstances,
  withInnerWires,
} from "./selection";

type Of<Type extends InteractionCommand["type"]> = Extract<InteractionCommand, { type: Type }>;

const ZOOM_STEP = 1.25;
const HALF = 0.5;
const SETTLED = { type: "cameraSettled" } as const;

const rectOfChip = (context: InteractionContext, instanceId: InstanceId): Rect | undefined => {
  const instance = context.scene.circuit.instances.find((item) => item.id === instanceId);
  return instance && layoutIn(context.scene, instance).rect;
};

const onScreen = (state: InteractionState, rect: Rect, context: InteractionContext): boolean => {
  const topLeft = worldToScreen(state.camera, rect);
  const bottomRight = worldToScreen(state.camera, {
    x: rect.x + rect.width,
    y: rect.y + rect.height,
  });
  const { width, height } = context.viewport;
  return topLeft.x >= 0 && topLeft.y >= 0 && bottomRight.x <= width && bottomRight.y <= height;
};

/** Brings a keyboard-selected chip into view, so focus never moves off screen. */
const revealed = (
  result: Interpreted,
  instanceId: InstanceId,
  context: InteractionContext,
): Interpreted => {
  const rect = rectOfChip(context, instanceId);
  if (rect === undefined || onScreen(result.state, rect, context)) {
    return result;
  }
  const centre = { x: rect.x + rect.width * HALF, y: rect.y + rect.height * HALF };
  const camera = centreOn(result.state.camera, centre, context.viewport);
  return { state: { ...result.state, camera }, effects: [...result.effects, SETTLED] };
};

/** From `at` (-1 for none) one step through `count` items, wrapping. */
const stepIndex = (at: number, count: number, forward: boolean): number => {
  if (at === -1) {
    return forward ? 0 : count - 1;
  }
  return (at + (forward ? 1 : -1) + count) % count;
};

/** `]` and `[`: the next or previous chip in canvas order, wrapping; `Shift` adds to the selection. */
const step = (
  state: InteractionState,
  command: Of<"selectNext" | "selectPrevious">,
  context: InteractionContext,
): Interpreted => {
  const ids = context.scene.circuit.instances.map((item) => item.id);
  const at = state.focus === undefined ? -1 : ids.indexOf(state.focus);
  const instanceId = ids.at(stepIndex(at, ids.length, command.type === "selectNext"));
  if (instanceId === undefined) {
    return done(state);
  }
  const selection = command.additive
    ? addInstances(state.selection, [instanceId])
    : selectInstances([instanceId]);
  return revealed(selected(state, selection, instanceId), instanceId, context);
};

const selectAll = (state: InteractionState, context: InteractionContext): Interpreted => {
  const { circuit } = context.scene;
  const all = selectInstances(circuit.instances.map((item) => item.id));
  return selected(state, withInnerWires(circuit, all));
};

/**
 * Escape closes the topmost thing: the bit picker, then a menu, then a placement or an armed pin
 * (both in `cancelWiring`), then a card,
 * then (in `bendKey`) bend mode, then an armed lasso, then the selection. A menu opened while a
 * pin is armed closes alone, so the pin stays armed for what the menu does; a pin card is how the
 * keyboard aims a wire, so it stays while Escape cancels the wire.
 */
const escape = (state: InteractionState): Interpreted => {
  if (state.bitPick === undefined && state.menu !== undefined) {
    return done(withoutOverlays(state));
  }
  const wiring = cancelWiring(state);
  if (wiring !== undefined) {
    return wiring;
  }
  if (state.card !== undefined) {
    return done(withoutOverlays(state));
  }
  if (state.lassoArmed) {
    return done({ ...state, lassoArmed: false });
  }
  return isEmpty(state.selection) ? done(state) : selected(state, EMPTY_SELECTION);
};

const nudge = (
  state: InteractionState,
  command: Of<"nudge">,
  context: InteractionContext,
): Interpreted => {
  const delta = { x: command.columns * GRID, y: command.rows * GRID };
  const shift = (position: Point): Point => ({ x: position.x + delta.x, y: position.y + delta.y });
  const moves = context.scene.circuit.instances
    .filter((item) => state.selection.instances.has(item.id))
    .map((item) => ({
      instanceId: item.id,
      position: shift(item.position),
    }));
  if (moves.length === 0) {
    const screenDelta = { x: -delta.x * state.camera.zoom, y: -delta.y * state.camera.zoom };
    return done({ ...state, camera: panBy(state.camera, screenDelta) }, SETTLED);
  }
  return done(
    state,
    { type: "dispatch", action: { type: "moveChips", chipId: context.chipId, moves } },
    { type: "announce", announcement: { type: "moved", count: moves.length } },
  );
};

const deleteSelection = (state: InteractionState, context: InteractionContext): Interpreted => {
  const { instances, wires } = state.selection;
  if (instances.size === 0 && wires.size === 0) {
    return done(state);
  }
  const { pinPick: _pinPick, ...open } = withoutOverlays(state);
  const action = {
    type: "removeItems",
    chipId: context.chipId,
    instanceIds: [...instances],
    wireIds: [...wires],
  } as const;
  return done(
    { ...open, selection: EMPTY_SELECTION },
    { type: "dispatch", action },
    { type: "announce", announcement: { type: "deleted", count: instances.size + wires.size } },
  );
};

const zoomed = (
  state: InteractionState,
  factor: number,
  context: InteractionContext,
): Interpreted => {
  const centre = { x: context.viewport.width * HALF, y: context.viewport.height * HALF };
  return done({ ...withoutOverlays(state), camera: zoomAt(state.camera, centre, factor) }, SETTLED);
};

const fit = (state: InteractionState, context: InteractionContext): Interpreted => {
  const rects = context.scene.circuit.instances.map((item) => layoutIn(context.scene, item).rect);
  return done(
    { ...withoutOverlays(state), camera: fitBounds(boundsOf(rects), context.viewport) },
    SETTLED,
  );
};

/** The chip the keys act on: the focused chip when it is selected, else a lone selected chip. */
const target = (state: InteractionState): InstanceId | undefined => {
  if (state.focus !== undefined && state.selection.instances.has(state.focus)) {
    return state.focus;
  }
  const [only, ...more] = state.selection.instances;
  return more.length === 0 ? only : undefined;
};

/** The chip menu for a chip selection; with no chip selected, the wire or canvas menu. */
const openMenu = (state: InteractionState, context: InteractionContext): Interpreted => {
  if (state.selection.instances.size === 0) {
    return openMenuByKey(state, context);
  }
  const instanceId = target(state);
  const rect = instanceId === undefined ? undefined : rectOfChip(context, instanceId);
  if (instanceId === undefined || rect === undefined) {
    return done(state);
  }
  const screen = worldToScreen(state.camera, { x: rect.x + rect.width, y: rect.y });
  return done({ ...withoutOverlays(state), menu: { kind: "chip", instanceId, screen } });
};

/** `P` / `Shift`+`P`: step through the target chip's pins, showing and announcing each one. */
const nextPin = (
  state: InteractionState,
  command: Of<"nextPin">,
  context: InteractionContext,
): Interpreted => {
  const instanceId = target(state);
  const instance = context.scene.circuit.instances.find((item) => item.id === instanceId);
  const pins = instance === undefined ? [] : layoutIn(context.scene, instance).pins;
  const at =
    state.card?.instanceId === instanceId
      ? pins.findIndex((pin) => pin.key === state.card?.pin)
      : -1;
  const pin = pins.at(stepIndex(at, pins.length, !command.backwards));
  if (instance === undefined || pin === undefined) {
    return done(state);
  }
  const card = {
    instanceId: instance.id,
    pin: pin.key,
    screen: worldToScreen(state.camera, pin.anchor),
    pinned: true,
  };
  return done(
    { ...state, card },
    { type: "announce", announcement: { type: "pin", instanceId: instance.id, pin: pin.key } },
  );
};

const setTool = (state: InteractionState, command: Of<"setTool">): Interpreted =>
  done(
    { ...state, tool: command.tool, lassoArmed: false },
    { type: "announce", announcement: { type: "tool", tool: command.tool } },
  );

type Handlers = {
  readonly [Type in InteractionCommand["type"]]: (
    state: InteractionState,
    command: Of<Type>,
    context: InteractionContext,
  ) => Interpreted;
};

// Compiler-linked: adding a command without a handler here fails typecheck.
const HANDLERS: Handlers = {
  setTool: (state, command) => setTool(state, command),
  selectNext: step,
  selectPrevious: step,
  selectAll: (state, _command, context) => selectAll(state, context),
  escape: (state) => escape(state),
  nudge,
  deleteSelection: (state, _command, context) => deleteSelection(state, context),
  undo: (state) => done(withoutOverlays(state), { type: "undo" }),
  redo: (state) => done(withoutOverlays(state), { type: "redo" }),
  zoomIn: (state, _command, context) => zoomed(state, ZOOM_STEP, context),
  zoomOut: (state, _command, context) => zoomed(state, 1 / ZOOM_STEP, context),
  fit: (state, _command, context) => fit(state, context),
  zoomBy: (state, command) =>
    done({
      ...withoutOverlays(state),
      camera: zoomAt(state.camera, command.screen, command.factor),
    }),
  panBy: (state, command) =>
    done({ ...withoutOverlays(state), camera: panBy(state.camera, command.delta) }),
  jumpTo: (state, command) =>
    done(
      { ...withoutOverlays(state), camera: command.camera },
      ...(command.settle ? [SETTLED] : []),
    ),
  openMenu: (state, _command, context) => openMenu(state, context),
  nextPin,
  showHelp: (state) => done({ ...withoutOverlays(state), help: true }),
  hideHelp: (state) => {
    const { help: _help, ...rest } = state;
    return done(rest);
  },
  ...WIRING_COMMANDS,
  ...MENU_COMMANDS,
  ...PIN_COMMANDS,
};

const run = <Type extends InteractionCommand["type"]>(
  state: InteractionState,
  command: Of<Type>,
  context: InteractionContext,
): Interpreted => HANDLERS[command.type](state, command, context);

/** A keyboard or toolbar command on the canvas; bend mode takes some keys first. */
export const onCommand = (
  state: InteractionState,
  command: InteractionCommand,
  context: InteractionContext,
): Interpreted => bendKey(state, command, context) ?? run(state, command, context);
