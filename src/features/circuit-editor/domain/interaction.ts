import type { Circuit, PinKey, Point } from "~/features/projects";
import type { ChipId, InstanceId } from "~/shared/ids";

import type { EditorAction } from "./actions";
import type { Camera } from "./camera";
import type { Size } from "./chip-layout";
import type { Scene } from "./geometry";
import type { Gesture } from "./gesture-types";
import type { Hit, SpatialIndex } from "./hit-test";
import { previewPositions } from "./move";
import { EMPTY_SELECTION, isEmpty, prune } from "./selection";
import type { Selection } from "./selection";

/** What a one-finger drag on empty canvas does (spec §5.3). */
export type Tool = "pan" | "select";

/** A drag in progress. Points are world units, except `pan`, which follows the screen. */
export type Drag =
  | { readonly kind: "move"; readonly origin: Point; readonly delta: Point }
  | { readonly kind: "pan"; readonly last: Point }
  | {
      readonly kind: "marquee";
      readonly shape: "box" | "lasso";
      readonly points: readonly Point[];
      readonly additive: boolean;
    };

interface PinCard {
  readonly instanceId: InstanceId;
  readonly pin: PinKey;
  /** Where the card points, in screen pixels. */
  readonly screen: Point;
  /** Opened by a tap, long-press or key: it stays until dismissed. A hover card follows the mouse. */
  readonly pinned: boolean;
}

interface ChipMenu {
  readonly instanceId: InstanceId;
  readonly screen: Point;
}

/** Everything the canvas shows that is not the circuit. None of it is an edit (ADR 8, 22). */
export interface InteractionState {
  readonly tool: Tool;
  readonly selection: Selection;
  /** The chip `]` / `[` step from and the pin card and chip menu keys act on. */
  readonly focus?: InstanceId;
  readonly camera: Camera;
  readonly hover?: Hit;
  readonly drag?: Drag;
  /** A long-press on empty canvas in the Select tool: the next drag draws a lasso. */
  readonly lassoArmed: boolean;
  readonly menu?: ChipMenu;
  readonly card?: PinCard;
}

export const initialInteraction = (camera: Camera, tool: Tool): InteractionState => ({
  tool,
  selection: EMPTY_SELECTION,
  camera,
  lassoArmed: false,
});

export type InteractionCommand =
  | { readonly type: "setTool"; readonly tool: Tool }
  | { readonly type: "selectNext" | "selectPrevious"; readonly additive: boolean }
  | { readonly type: "selectAll" }
  | { readonly type: "escape" }
  /** Moves the selection, or pans when nothing is selected, by whole grid steps. */
  | { readonly type: "nudge"; readonly columns: number; readonly rows: number }
  | { readonly type: "deleteSelection" }
  | { readonly type: "undo" | "redo" }
  | { readonly type: "zoomIn" | "zoomOut" | "fit" }
  /** Wheel input: zoom about a screen point, or pan by a screen delta. */
  | { readonly type: "zoomBy"; readonly screen: Point; readonly factor: number }
  | { readonly type: "panBy"; readonly delta: Point }
  | { readonly type: "openMenu" }
  | { readonly type: "nextPin"; readonly backwards: boolean };

export type InteractionInput =
  | { readonly type: "gesture"; readonly gesture: Gesture }
  | { readonly type: "command"; readonly command: InteractionCommand }
  /** The open chip changed (an edit, undo or redo): drop what no longer exists. */
  | { readonly type: "historyChanged" };

/** What the store should say through the live region; the UI words it. */
export type Announcement =
  | {
      readonly type: "selected";
      readonly instanceIds: readonly InstanceId[];
      readonly wires: number;
    }
  | { readonly type: "cleared" }
  | { readonly type: "moved"; readonly count: number }
  | { readonly type: "deleted"; readonly count: number }
  | { readonly type: "tool"; readonly tool: Tool }
  | { readonly type: "pin"; readonly instanceId: InstanceId; readonly pin: PinKey };

export type Effect =
  | { readonly type: "dispatch"; readonly action: EditorAction }
  | { readonly type: "undo" | "redo" }
  /** A camera gesture ended: write the camera to the URL now. */
  | { readonly type: "cameraSettled" }
  | { readonly type: "announce"; readonly announcement: Announcement };

/** What interpreting an input reads; `index` is built lazily, only when a hit-test needs it. */
export interface InteractionContext {
  readonly scene: Scene;
  readonly chipId: ChipId;
  readonly viewport: Size;
  readonly index: () => SpatialIndex;
}

export interface Interpreted {
  readonly state: InteractionState;
  readonly effects: readonly Effect[];
}

export const done = (state: InteractionState, ...effects: readonly Effect[]): Interpreted => ({
  state,
  effects,
});

/** The chips being dragged and where they are drawn; empty when no move is in progress. */
export const previewOf = (
  state: InteractionState,
  circuit: Circuit,
): ReadonlyMap<InstanceId, Point> =>
  state.drag?.kind === "move"
    ? previewPositions(circuit, state.selection.instances, state.drag.delta)
    : new Map();

const stillThere = <Overlay extends { readonly instanceId: InstanceId }>(
  overlay: Overlay | undefined,
  ids: ReadonlySet<InstanceId>,
): Overlay | undefined =>
  overlay !== undefined && ids.has(overlay.instanceId) ? overlay : undefined;

/** After an edit, undo or redo: forget selected, focused and overlaid chips that are gone. */
export const afterHistory = (state: InteractionState, circuit: Circuit): InteractionState => {
  const ids = new Set(circuit.instances.map((item) => item.id));
  const { focus, menu, card, hover: _hover, ...rest } = state;
  return {
    ...rest,
    selection: prune(state.selection, circuit),
    ...(focus !== undefined && ids.has(focus) ? { focus } : {}),
    ...(stillThere(menu, ids) === undefined ? {} : { menu }),
    ...(stillThere(card, ids) === undefined ? {} : { card }),
  };
};

/** The state with the chip menu and pin card closed. */
export const withoutOverlays = (state: InteractionState): InteractionState => {
  const { menu: _menu, card: _card, ...rest } = state;
  return rest;
};

const selectionAnnouncement = (selection: Selection): Effect => ({
  type: "announce",
  announcement: isEmpty(selection)
    ? { type: "cleared" }
    : {
        type: "selected",
        instanceIds: [...selection.instances],
        wires: selection.wires.size,
      },
});

/** A new selection, focused on `focus` when given; overlays close and it is announced. */
export const selected = (
  state: InteractionState,
  selection: Selection,
  focus?: InstanceId,
): Interpreted => {
  const { focus: previous, lassoArmed: _lassoArmed, ...rest } = withoutOverlays(state);
  const next = focus ?? previous;
  return done(
    { ...rest, lassoArmed: false, selection, ...(next === undefined ? {} : { focus: next }) },
    selectionAnnouncement(selection),
  );
};
