import type {
  ConnectionError,
  PinDirection,
  PinKey,
  PinRef,
  Point,
  WireColor,
} from "~/features/projects";
import type { ChipId, InstanceId, PinId, WireId } from "~/shared/ids";

import type { EditorAction, PlaceableKind } from "./actions";
import type { ArrayRequest } from "./array";
import type { Camera } from "./camera";
import type { Scene, Size } from "./geometry";
import type { Drag, Gesture } from "./gesture-types";
import type { Hit, SpatialIndex } from "./hit-test";
import { dragPreview } from "./pin-snap";
import type { DragPreview } from "./pin-snap";
import { EMPTY_SELECTION, isEmpty } from "./selection";
import type {
  Clipboard,
  ClipboardDid,
  Notice,
  PinAnnouncement,
  PinCommand,
  Selection,
  SuggestAnnouncement,
  SuggestCommand,
  Suggestions,
  ViewCommand,
} from "./selection";

/** What a one-finger drag on empty canvas does (spec §5.3). */
export type Tool = "pan" | "select";

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

/** Bend mode on `wireId`; `segment` is the interior segment index arrows move (and Task 8 marks). */
export interface Bends {
  readonly wireId: WireId;
  readonly segment: number;
}

/** A context menu: a chip's, a wire's or the canvas's. */
export type Menu =
  | { readonly kind: "chip"; readonly instanceId: InstanceId; readonly screen: Point }
  | { readonly kind: "wire"; readonly wireId: WireId; readonly screen: Point }
  | { readonly kind: "canvas"; readonly screen: Point };

/** A pin piece's name being edited in place; the popover opens at `screen` (screen pixels). */
export interface Renaming {
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
  readonly menu?: Menu;
  readonly card?: PinCard;
  /** A pin is armed: the next tap on a legal pin, or a drag's release over one, wires it. */
  readonly armed?: Armed;
  readonly bitPick?: BitPick;
  /** Bend mode: the wire whose segments move, and the interior segment the keys move. */
  readonly bends?: Bends;
  /** The colour new wires get; missing means the default. */
  readonly wireColor?: WireColor;
  /** The keyboard help dialog is open; `arraying`: the Array dialog is. */
  readonly help?: true;
  readonly arraying?: true;
  /** Why the last connection was refused, shown over the canvas until the next gesture or command. */
  readonly notice?: Notice;
  /** Pick pins is on: a plain tap on a pin picks it (D9). */
  readonly pinPick?: true;
  readonly renaming?: Renaming;
  /** Armed placement: every tap on the canvas places a copy of this part until cancelled (D6). */
  readonly placing?: PlaceableKind;
  /** The last kinds placed this session, newest first, without repeats (D9). */
  readonly recent: readonly PlaceableKind[];
  /** What Ctrl+C or Ctrl+X took, for Ctrl+V. */
  readonly clipboard?: Clipboard;
  /** Proposed wires shown as ghosts until accepted or dismissed (D9). */
  readonly suggestions?: Suggestions;
}

export const initialInteraction = (camera: Camera, tool: Tool): InteractionState => ({
  tool,
  selection: EMPTY_SELECTION,
  camera,
  lassoArmed: false,
  recent: [],
});

export type InteractionCommand =
  | { readonly type: "setTool"; readonly tool: Tool }
  | { readonly type: "selectNext" | "selectPrevious"; readonly additive: boolean }
  | { readonly type: "selectAll" }
  | { readonly type: "escape" }
  /** Moves the selection, or pans when nothing is selected, by whole grid steps. */
  | { readonly type: "nudge"; readonly columns: number; readonly rows: number }
  | { readonly type: "deleteSelection" }
  /** Copies (or cuts) the selected parts and the wires between them; paste adds a fresh copy. */
  | { readonly type: "copy" | "cut" | "paste" }
  | { readonly type: "undo" | "redo" }
  | { readonly type: "zoomIn" | "zoomOut" | "fit" }
  /** Wheel input: zoom about a screen point, or pan by a screen delta. */
  | { readonly type: "zoomBy"; readonly screen: Point; readonly factor: number }
  | { readonly type: "panBy"; readonly delta: Point }
  /** The minimap moved the camera; `settle` ends the gesture and writes the URL. */
  | { readonly type: "jumpTo"; readonly camera: Camera; readonly settle: boolean }
  | { readonly type: "openMenu" }
  | { readonly type: "nextPin"; readonly backwards: boolean }
  /** Selects the next (or previous) wire touching the focused chip. */
  | { readonly type: "nextWire"; readonly backwards: boolean }
  | { readonly type: "showHelp" | "hideHelp" | "duplicate" | "showArray" | "hideArray" }
  | { readonly type: "array"; readonly request: ArrayRequest }
  /** Arms the pin in the card, else the focused chip's first pin. */
  | { readonly type: "arm" }
  /** Wires the armed pin to the pin in the card. */
  | { readonly type: "connect" }
  | { readonly type: "pickBit"; readonly bit: number }
  | { readonly type: "setWireColor"; readonly color?: WireColor }
  /** Recolours every selected wire; no colour is the default. */
  | { readonly type: "recolorSelection"; readonly color?: WireColor }
  | { readonly type: "rerouteWire"; readonly wireId: WireId }
  /** Re-routes every automatic wire in the open chip. */
  | { readonly type: "tidyWires" }
  /** Arms the wire's source, in its colour, for a new wire. */
  | { readonly type: "branch"; readonly wireId: WireId }
  /** Enters bend mode for the wire. */
  | { readonly type: "editBends"; readonly wireId: WireId }
  /** Selects pin pieces (the Pins panel), focusing the first. */
  | { readonly type: "selectPieces"; readonly instanceIds: readonly InstanceId[] }
  /** Opens the rename popover at a pin piece's name; `endRename` closes it. */
  | { readonly type: "startRename"; readonly instanceId: InstanceId }
  | { readonly type: "endRename" }
  /** Arms placement of `kind`; arming the armed kind again cancels it. */
  | { readonly type: "armPlacement"; readonly kind: PlaceableKind }
  | { readonly type: "cancelPlacement" }
  /** Places one `kind` centred on `screen`, or on the viewport's centre without one. */
  | { readonly type: "placeAt"; readonly kind: PlaceableKind; readonly screen?: Point }
  /** Adds one 1-bit pin of the open chip, its piece centred on `screen`, or on the viewport centre. */
  | { readonly type: "addPinAt"; readonly direction: PinDirection; readonly screen?: Point }
  | PinCommand
  | SuggestCommand
  | ViewCommand;

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
  | { readonly type: "clipboard"; readonly did: ClipboardDid; readonly count: number }
  | { readonly type: "tool"; readonly tool: Tool }
  | { readonly type: "pin"; readonly instanceId: InstanceId; readonly pin: PinKey }
  | { readonly type: "armed"; readonly instanceId: InstanceId; readonly pin: PinKey }
  | { readonly type: "wired" }
  | { readonly type: "disarmed" }
  /** A connection was refused: `reason` says why. */
  | { readonly type: "refused"; readonly reason: ConnectionError }
  /** A wire was selected from the keyboard: its ends are named. */
  | { readonly type: "wireSelected"; readonly wireId: WireId }
  /** Bend mode began (`active`) or ended. */
  | { readonly type: "bends"; readonly active: boolean }
  /** Placement was armed (`kind`) or cancelled (no `kind`). */
  | { readonly type: "placing"; readonly kind: PlaceableKind | undefined }
  | { readonly type: "placed"; readonly kind: PlaceableKind }
  | { readonly type: "pinAdded"; readonly direction: PinDirection; readonly name: string }
  | PinAnnouncement
  | SuggestAnnouncement;

export type Effect =
  | { readonly type: "dispatch"; readonly action: EditorAction }
  | { readonly type: "undo" | "redo" }
  /** A camera gesture ended: write the camera to the URL now. */
  | { readonly type: "cameraSettled" }
  /** Sets an input pin of the open chip, as the Pins panel does. */
  | { readonly type: "setInput"; readonly pinId: PinId; readonly value: number }
  | { readonly type: "announce"; readonly announcement: Announcement };

/** What interpreting an input reads; `index` is built lazily, only when a hit-test needs it. */
export interface InteractionContext {
  readonly scene: Scene;
  readonly chipId: ChipId;
  readonly viewport: Size;
  readonly index: () => SpatialIndex;
  /** The id a new wire gets. */
  readonly newWireId: () => WireId;
  /** The input values set so far; a missing one is 0. */
  readonly inputs: ReadonlyMap<PinId, number>;
}

export interface Interpreted {
  readonly state: InteractionState;
  readonly effects: readonly Effect[];
}

export const done = (state: InteractionState, ...effects: readonly Effect[]): Interpreted => ({
  state,
  effects,
});

/**
 * The chips being dragged, where they are drawn (and will drop), and a lone pin piece's guide;
 * empty when no move is in progress.
 */
export const movePreviewOf = (state: InteractionState, scene: Scene): DragPreview =>
  state.drag?.kind === "move"
    ? dragPreview(scene, state.selection.instances, state.drag.delta)
    : { positions: new Map() };

/** Just the positions of `movePreviewOf`. */
export const previewOf = (state: InteractionState, scene: Scene): ReadonlyMap<InstanceId, Point> =>
  movePreviewOf(state, scene).positions;

/** The state with the menu, pin card, bit picker and rename closed; an armed pin stays armed. */
export const withoutOverlays = (state: InteractionState): InteractionState => {
  const { menu: _menu, card: _card, bitPick: _bitPick, renaming: _renaming, ...rest } = state;
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
  const { focus: previous, lassoArmed: _lassoArmed, pinPick, ...others } = withoutOverlays(state);
  const rest = isEmpty(selection) || pinPick === undefined ? others : { ...others, pinPick };
  const next = focus ?? previous;
  return done(
    { ...rest, lassoArmed: false, selection, ...(next === undefined ? {} : { focus: next }) },
    selectionAnnouncement(selection),
  );
};
