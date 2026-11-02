import { describe, expect, it } from "vitest";

import { dispatched, NAND_A, wiring } from "./interaction-wiring.fixtures";
import { command as run } from "./interaction.fixtures";
import { commandForKey } from "./keymap";
import type { KeyPress } from "./keymap";

const press = (key: string, more: Partial<KeyPress> = {}): KeyPress => ({
  key,
  shift: false,
  ctrlOrMeta: false,
  alt: false,
  ...more,
});

describe("clipboard keys", () => {
  it.each([
    [press("c", { ctrlOrMeta: true }), { type: "copy" }],
    [press("x", { ctrlOrMeta: true }), { type: "cut" }],
    [press("v", { ctrlOrMeta: true }), { type: "paste" }],
    [press("V", { ctrlOrMeta: true, shift: true }), { type: "paste" }],
  ])("maps %o to %o", (key, command) => {
    expect(commandForKey(key)).toEqual(command);
  });
});

describe("commandForKey", () => {
  it.each([
    [press("]"), { type: "selectNext", additive: false }],
    [press("]", { shift: true }), { type: "selectNext", additive: true }],
    [press("}", { shift: true }), { type: "selectNext", additive: true }],
    [press("["), { type: "selectPrevious", additive: false }],
    [press("{", { shift: true }), { type: "selectPrevious", additive: true }],
    [press("Escape"), { type: "escape" }],
    [press("Delete"), { type: "deleteSelection" }],
    [press("Backspace"), { type: "deleteSelection" }],
    [press("ArrowRight"), { type: "nudge", columns: 1, rows: 0 }],
    [press("ArrowUp", { shift: true }), { type: "nudge", columns: 0, rows: -4 }],
    [press("ArrowLeft"), { type: "nudge", columns: -1, rows: 0 }],
    [press("ArrowDown"), { type: "nudge", columns: 0, rows: 1 }],
    [press("+"), { type: "zoomIn" }],
    [press("="), { type: "zoomIn" }],
    [press("-"), { type: "zoomOut" }],
    [press("_", { shift: true }), { type: "zoomOut" }],
    [press("0"), { type: "fit" }],
    [press("Enter"), { type: "openMenu" }],
    [press("ContextMenu"), { type: "openMenu" }],
    [press("F10", { shift: true }), { type: "openMenu" }],
    [press("p"), { type: "nextPin", backwards: false }],
    [press("P", { shift: true }), { type: "nextPin", backwards: true }],
    [press("v"), { type: "setTool", tool: "select" }],
    [press("h"), { type: "setTool", tool: "pan" }],
    [press("?", { shift: true }), { type: "showHelp" }],
    [press("w"), { type: "arm" }],
    [press("z", { ctrlOrMeta: true }), { type: "undo" }],
    [press("Z", { ctrlOrMeta: true, shift: true }), { type: "redo" }],
    [press("y", { ctrlOrMeta: true }), { type: "redo" }],
    [press("a", { ctrlOrMeta: true }), { type: "selectAll" }],
  ])("%o → %o", (key, command) => {
    expect(commandForKey(key)).toEqual(command);
  });

  it.each([
    press("Tab"),
    press("Tab", { shift: true }),
    press("F10"),
    press("0", { ctrlOrMeta: true }),
    press("f", { ctrlOrMeta: true }),
    press("ArrowLeft", { alt: true }),
    press("x"),
  ])("leaves %o to the browser", (key) => {
    expect(commandForKey(key)).toBeUndefined();
  });
});

describe("wire stepping keys", () => {
  it.each([
    [press("n"), { type: "nextWire", backwards: false }],
    [press("n", { shift: true }), { type: "nextWire", backwards: true }],
    [press("N", { shift: true }), { type: "nextWire", backwards: true }],
  ])("steps wires: %o → %o", (key, command) => {
    expect(commandForKey(key)).toEqual(command);
  });
});

describe("wiring keys", () => {
  it("w arms the pin in the card", () => {
    const { context, state, nand } = wiring();
    const card = { instanceId: nand.id, pin: 0, screen: NAND_A, pinned: true };
    const key = commandForKey(press("w"));
    expect(key).toEqual({ type: "arm" });
    const armed = run({ ...state, card }, context, key!).state;
    expect(armed.armed?.end).toEqual({ instanceId: nand.id, pin: 0 });
  });

  it("Enter connects when armed", () => {
    const { context, state, nand, pieceA } = wiring();
    expect(commandForKey(press("Enter"), { armed: true })).toEqual({ type: "connect" });
    expect(commandForKey(press("Enter"), { armed: false })).toEqual({ type: "openMenu" });
    // The context-menu keys still open the menu while armed.
    expect(commandForKey(press("ContextMenu"), { armed: true })).toEqual({ type: "openMenu" });
    const armed = run({ ...state, focus: pieceA.id }, context, { type: "arm" }).state;
    const card = { instanceId: nand.id, pin: 0, screen: NAND_A, pinned: true };
    const key = commandForKey(press("Enter"), { armed: armed.armed !== undefined });
    const result = run({ ...armed, card }, context, key!);
    expect(dispatched(result.effects)).toEqual([
      expect.objectContaining({ type: "connectWire", to: { instanceId: nand.id, pin: 0 } }),
    ]);
  });
});

describe("rename key", () => {
  it("F2 renames the focused piece; with nothing focused it is the browser's", () => {
    const { state, pieceA } = wiring();
    expect(commandForKey(press("F2"), { armed: false, focus: pieceA.id })).toEqual({
      type: "startRename",
      instanceId: pieceA.id,
    });
    expect(commandForKey(press("F2"), { armed: false, focus: state.focus })).toBeUndefined();
  });
});
