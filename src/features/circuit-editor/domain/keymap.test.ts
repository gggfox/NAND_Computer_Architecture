import { describe, expect, it } from "vitest";

import { commandForKey } from "./keymap";
import type { KeyPress } from "./keymap";

const press = (key: string, more: Partial<KeyPress> = {}): KeyPress => ({
  key,
  shift: false,
  ctrlOrMeta: false,
  alt: false,
  ...more,
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
    press("c", { ctrlOrMeta: true }),
    press("ArrowLeft", { alt: true }),
    press("x"),
  ])("leaves %o to the browser", (key) => {
    expect(commandForKey(key)).toBeUndefined();
  });
});
