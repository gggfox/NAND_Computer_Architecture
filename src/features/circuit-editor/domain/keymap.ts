import type { InstanceId } from "~/shared/ids";

import type { InteractionCommand, InteractionState } from "./interaction";

/** The parts of a `KeyboardEvent` the canvas reads. */
export interface KeyPress {
  readonly key: string;
  readonly shift: boolean;
  /** Ctrl, or ⌘ on Apple keyboards. */
  readonly ctrlOrMeta: boolean;
  readonly alt: boolean;
}

/** Shift-step size for arrow keys, in grid steps. */
const BIG_STEP = 4;

const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Keys that mean the same with or without Shift (Shift turns `]` into `}` on US layouts). */
const PLAIN: ReadonlyMap<string, (shift: boolean) => InteractionCommand> = new Map<
  string,
  (shift: boolean) => InteractionCommand
>([
  ["]", (additive) => ({ type: "selectNext", additive })],
  ["}", () => ({ type: "selectNext", additive: true })],
  ["[", (additive) => ({ type: "selectPrevious", additive })],
  ["{", () => ({ type: "selectPrevious", additive: true })],
  ["Escape", () => ({ type: "escape" })],
  ["Delete", () => ({ type: "deleteSelection" })],
  ["Backspace", () => ({ type: "deleteSelection" })],
  ["+", () => ({ type: "zoomIn" })],
  ["=", () => ({ type: "zoomIn" })],
  ["-", () => ({ type: "zoomOut" })],
  ["_", () => ({ type: "zoomOut" })],
  ["0", () => ({ type: "fit" })],
  ["Enter", () => ({ type: "openMenu" })],
  ["ContextMenu", () => ({ type: "openMenu" })],
  ["p", (backwards) => ({ type: "nextPin", backwards })],
  ["P", () => ({ type: "nextPin", backwards: true })],
  ["v", () => ({ type: "setTool", tool: "select" })],
  ["h", () => ({ type: "setTool", tool: "pan" })],
  ["?", () => ({ type: "showHelp" })],
  ["w", () => ({ type: "arm" })],
  ["a", () => ({ type: "selectPinOnAll" })],
  ["A", () => ({ type: "selectPinOnAll" })],
  ["n", (backwards) => ({ type: "nextWire", backwards })],
  ["N", () => ({ type: "nextWire", backwards: true })],
]);

/**
 * What the map reads from the canvas: `Enter` wires instead of opening a menu while a pin is armed
 * or pins are selected with a pin card open (`wiring`), and `F2` renames the focused pin piece.
 */
interface KeyContext {
  readonly wiring: boolean;
  /** Suggested wires show: `n`/`N` cycle them instead of the wires. */
  readonly ghosts?: boolean;
  /** A suggested wire is focused: `Enter` accepts it. */
  readonly ghostFocused?: boolean;
  readonly focus?: InstanceId | undefined;
}

/** Whether `Enter` wires (D10): a pin is armed, or pins are selected and a pin card is open. */
export const keyWiring = (state: InteractionState): boolean =>
  state.armed !== undefined || (state.selection.pins.length > 0 && state.card !== undefined);

/** `F2` renames the focused chip when it is a pin piece; with nothing focused it is the browser's. */
const f2 = (context?: KeyContext): InteractionCommand | undefined =>
  context?.focus === undefined ? undefined : { type: "startRename", instanceId: context.focus };

/** Keys that mean something only with Shift held; plain `Space` stays the browser's. */
const SHIFTED: ReadonlyMap<string, InteractionCommand> = new Map<string, InteractionCommand>([
  [" ", { type: "togglePin" }],
  ["W", { type: "suggestWires" }],
]);

/** Keys that mean something else while suggested wires show (D12). */
const GHOST_KEYS: ReadonlyMap<string, (shift: boolean) => InteractionCommand> = new Map<
  string,
  (shift: boolean) => InteractionCommand
>([
  ["n", (backwards) => ({ type: "nextGhost", backwards })],
  ["N", () => ({ type: "nextGhost", backwards: true })],
]);

const ghostKey = (press: KeyPress, context?: KeyContext): InteractionCommand | undefined => {
  if (press.key === "Enter" && context?.ghostFocused === true) {
    return { type: "acceptGhost" };
  }
  return context?.ghosts === true ? GHOST_KEYS.get(press.key)?.(press.shift) : undefined;
};

const plainKey = (press: KeyPress, context?: KeyContext): InteractionCommand | undefined => {
  const ghost = ghostKey(press, context);
  if (ghost !== undefined) {
    return ghost;
  }
  if (press.key === "Enter" && context?.wiring === true) {
    return { type: "connect" };
  }
  return (press.shift ? SHIFTED.get(press.key) : undefined) ?? PLAIN.get(press.key)?.(press.shift);
};

/** With Ctrl or ⌘ (keys lowercased): only the editing shortcuts; the rest stay the browser's. */
const WITH_CTRL: ReadonlyMap<string, (shift: boolean) => InteractionCommand> = new Map<
  string,
  (shift: boolean) => InteractionCommand
>([
  ["z", (shift) => ({ type: shift ? "redo" : "undo" })],
  ["y", () => ({ type: "redo" })],
  ["a", () => ({ type: "selectAll" })],
  ["c", () => ({ type: "copy" })],
  ["x", () => ({ type: "cut" })],
  ["v", () => ({ type: "paste" })],
  ["d", (shift) => ({ type: shift ? "showArray" : "duplicate" })],
]);

const withCtrl = ({ key, shift }: KeyPress): InteractionCommand | undefined =>
  WITH_CTRL.get(key.toLowerCase())?.(shift);

/** `Shift`+`F10` is the standard keyboard context-menu key; plain F10 stays the browser's. */
const shiftF10 = (press: KeyPress): InteractionCommand | undefined =>
  press.shift ? { type: "openMenu" } : undefined;

type KeyRead = (press: KeyPress, context?: KeyContext) => InteractionCommand | undefined;

const FUNCTION_KEYS: ReadonlyMap<string, KeyRead> = new Map<string, KeyRead>([
  ["F2", (_press, context) => f2(context)],
  ["F10", shiftF10],
]);

/**
 * The canvas keyboard map (Phase 2 plan, "Keyboard map"). `undefined` means the key is not the
 * canvas's: it is left to the browser, so Tab always moves focus on and nothing traps it.
 */
export const commandForKey = (
  press: KeyPress,
  context?: KeyContext,
): InteractionCommand | undefined => {
  if (press.ctrlOrMeta) {
    return withCtrl(press);
  }
  if (press.alt) {
    return undefined;
  }
  const arrow = ARROWS[press.key];
  if (arrow !== undefined) {
    const step = press.shift ? BIG_STEP : 1;
    return { type: "nudge", columns: arrow[0] * step, rows: arrow[1] * step };
  }
  return (FUNCTION_KEYS.get(press.key) ?? plainKey)(press, context);
};
