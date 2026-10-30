import type { InteractionCommand } from "./interaction";

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
]);

/** What the map reads from the canvas: `Enter` wires an armed pin instead of opening a menu. */
interface KeyContext {
  readonly armed: boolean;
}

const plainKey = (press: KeyPress, context?: KeyContext): InteractionCommand | undefined =>
  press.key === "Enter" && context?.armed === true
    ? { type: "connect" }
    : PLAIN.get(press.key)?.(press.shift);

/** With Ctrl or ⌘: only the editing shortcuts; everything else stays the browser's. */
const withCtrl = ({ key, shift }: KeyPress): InteractionCommand | undefined => {
  switch (key.toLowerCase()) {
    case "z": {
      return { type: shift ? "redo" : "undo" };
    }
    case "y": {
      return { type: "redo" };
    }
    case "a": {
      return { type: "selectAll" };
    }
    default: {
      return undefined;
    }
  }
};

/** `Shift`+`F10` is the standard keyboard context-menu key; plain F10 stays the browser's. */
const shiftF10 = (press: KeyPress): InteractionCommand | undefined =>
  press.shift ? { type: "openMenu" } : undefined;

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
  return press.key === "F10" ? shiftF10(press) : plainKey(press, context);
};
