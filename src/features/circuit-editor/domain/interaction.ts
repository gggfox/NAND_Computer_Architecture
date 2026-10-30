import type { Circuit, PinKey, PinRef, Point, WireColor } from "~/features/projects";
import type { ChipId, InstanceId, WireId } from "~/shared/ids";

import type { EditorAction } from "./actions";
import type { Camera } from "./camera";
import type { Size } from "./chip-layout";
import type { Scene } from "./geometry";
import type { Gesture } from "./gesture-types";
import type { Hit, SpatialIndex } from "./hit-test";
import { previewPositions } from "./move";
import { EMPTY_SELECTION, isEmpty } from "./selection";
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
    }
  /** A new wire follows the pointer from `from`; it connects on release over a legal pin. */
  | {
      readonly kind: "wire";
      readonly from: PinRef;
      readonly color?: WireColor;
      readonly point: Point;
    }
  /** Moves interior segment `index` of the wire in bend mode by `offset` world px. */
  | {
      readonly kind: "segment";
      readonly wireId: WireId;
      readonly index: number;
      readonly offset: number;
    };

export interface PinCard {
  readonly instanceId: InstanceId;
  readonly pin: PinKey;
  /** Where the card points, in screen pixels. */
  readonly screen: Point;
  /** Opened by a tap, long-press or key: it stays until dismissed. A hover card follows the mouse. */
  readonly pinned: boolean;
}

/** A pin waiting for the other end of a wire; `legal` holds the `pinLevelKey`s it may reach. */
export interface Armed {
  readonly end: PinRef;
  readonly color?: WireColor;
  readonly legal: ReadonlySet<string>;
}

/** The bit picker: which bit of the bus end (`bus`) the new wire takes. */
export interface BitPick {
  readonly armed: PinRef;
  readonly target: PinRef;
  readonly bus: "armed" | "target";
  readonly bits: readonly number[];
  readonly color?: WireColor;
  /** Where the picker points, in screen pixels. */
  readonly screen: Point;
}

/** A context menu: a chip's, a wire's or the canvas's. */
export type Menu =
  | { readonly kind: "chip"; readonly instanceId: InstanceId; readonly screen: Point }
  | { readonly kind: "wire"; readonly wireId: WireId; readonly screen: Point }
  | { readonly kind: "canvas"; readonly screen: Point };

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
  readonly menu?: Menu;
  readonly card?: PinCard;
  /** A pin is armed: the next tap on a legal pin, or a drag's release over one, wires it. */
  readonly armed?: Armed;
  readonly bitPick?: BitPick;
  /** The wire in bend mode. */
  readonly bends?: WireId;
  /** The colour new wires get; missing means the default. */
  readonly wireColor?: WireColor;
  /** The keyboard help dialog is open. */
  readonly help?: true;
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
  /** The minimap moved the camera; `settle` ends the gesture and writes the URL. */
  | { readonly type: "jumpTo"; readonly camera: Camera; readonly settle: boolean }
  | { readonly type: "openMenu" }
  | { readonly type: "nextPin"; readonly backwards: boolean }
  | { readonly type: "showHelp" | "hideHelp" }
  /** Arms the pin in the card, else the focused chip's first pin. */
  | { readonly type: "arm" }
  /** Wires the armed pin to the pin in the card. */
  | { readonly type: "connect" }
  | { readonly type: "pickBit"; readonly bit: number }
  | { readonly type: "setWireColor"; readonly color?: WireColor };

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
  | { readonly type: "pin"; readonly instanceId: InstanceId; readonly pin: PinKey }
  | { readonly type: "armed"; readonly instanceId: InstanceId; readonly pin: PinKey }
  | { readonly type: "wired" }
  | { readonly type: "disarmed" };

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
  /** The id a new wire gets. */
  readonly newWireId: () => WireId;
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

/** The state with the menu, pin card and bit picker closed; an armed pin stays armed. */
export const withoutOverlays = (state: InteractionState): InteractionState => {
  const { menu: _menu, card: _card, bitPick: _bitPick, ...rest } = state;
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
