/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { EMPTY_CIRCUIT, newChip, pinDef, pinPiece, piece, projectWith } from "~/features/projects";
import type { BitWidth, Chip, Circuit, PinDef } from "~/features/projects";
import { newPinId } from "~/shared/ids";

import { createLayoutCache, GRID, layoutOf, PIN_CELL } from "./chip-layout";
import type { ChipLayout, LayoutSource } from "./chip-layout";

const ORIGIN = { x: 0, y: 0 };

type PinSpec = readonly [string, BitWidth?];

/** A saved chip with the given inputs and outputs, and a source whose open chip is empty. */
const savedChip = (name: string, inputs: readonly PinSpec[], outputs: readonly PinSpec[]) => {
  const defs = (specs: readonly PinSpec[], direction: PinDef["direction"]) =>
    specs.map(([pinName, width]) => pinDef(pinName, direction, width));
  const pins = [...defs(inputs, "input"), ...defs(outputs, "output")];
  const circuit: Circuit = { pins, instances: pins.map((def) => pinPiece(def)), wires: [] };
  return newChip(name, circuit, { saved: true });
};

const sourceWith = (chips: readonly Chip[], circuit: Circuit = EMPTY_CIRCUIT): LayoutSource => ({
  project: projectWith("p", [newChip("Open", circuit), ...chips]),
  circuit,
});

const customLayout = (chip: Chip): ChipLayout =>
  layoutOf(sourceWith([chip]), piece({ type: "custom", chipId: chip.id }, ORIGIN));

const anchorsOf = (layout: ChipLayout) => layout.pins.map((pin) => [pin.side, pin.anchor.y]);

describe("layoutOf custom chips", () => {
  it("stacks pins in 2/3/4/5-cell slots; the taller side sets the height", () => {
    const layout = customLayout(savedChip("ADD3", [["a"], ["b"], ["c"]], [["sum", 4]]));
    expect(layout.rect).toEqual({ x: 0, y: 0, width: 3 * GRID, height: 6 * PIN_CELL });
    expect(anchorsOf(layout)).toEqual([
      ["left", 20],
      ["left", 60],
      ["left", 100],
      ["right", 60],
    ]);
    expect(layout.pins.map((pin) => pin.label)).toEqual(["a", "b", "c", "sum[4]"]);
    expect(layout.pins[3]?.anchor.x).toBe(3 * GRID);
  });

  it("spreads the slack around the pins of the shorter side, snapped to the half-grid", () => {
    // Six cells tall; two 2-cell slots on the left leave 2 cells of slack: 2/3 cell per gap.
    const layout = customLayout(savedChip("X", [["a"], ["b"]], [["x"], ["y"], ["z"]]));
    const [first, second] = layout.pins.map((pin) => pin.anchor.y);
    expect(layout.rect.height).toBe(6 * PIN_CELL);
    expect(first).toBe(2 * PIN_CELL);
    expect(second).toBe(4 * PIN_CELL);
  });

  it("widens to fit the title and labels, in whole grid steps", () => {
    const narrow = customLayout(savedChip("A", [["a"]], [["y"]])).rect.width;
    const wide = customLayout(savedChip("A very long chip name", [["a"]], [["y"]])).rect.width;
    expect(narrow).toBe(2 * GRID);
    expect(wide).toBeGreaterThan(5 * GRID);
    expect(wide % GRID).toBe(0);
  });

  it("draws a bus as a taller tab than a single bit", () => {
    const layout = customLayout(savedChip("B", [["a"]], [["d", 8]]));
    const [bit, bus] = layout.pins;
    expect(bus?.label).toBe("d[8]");
    expect(bus?.tab.height).toBeGreaterThan(bit?.tab.height ?? 0);
    expect(bus?.tab.y).toBeCloseTo((bus?.anchor.y ?? 0) - (bus?.tab.height ?? 0) / 2);
  });

  it("an unsaved or missing chip has a title but no pins", () => {
    const draft = newChip("Draft");
    const layout = layoutOf(sourceWith([draft]), piece({ type: "custom", chipId: draft.id }));
    expect(layout).toMatchObject({ title: "Draft", pins: [] });
    expect(layout.rect).toMatchObject({ width: 2 * GRID, height: GRID });
  });
});

const expectOnLattice = (layout: ChipLayout): void => {
  for (const side of ["left", "right"] as const) {
    const ys = layout.pins.filter((pin) => pin.side === side).map((pin) => pin.anchor.y);
    expect(ys.toSorted((a, b) => a - b)).toEqual(ys);
    expect(new Set(ys).size).toBe(ys.length);
  }
  for (const pin of layout.pins) {
    expect((pin.anchor.y - layout.rect.y) % PIN_CELL).toBe(0);
    expect(pin.anchor.y).toBeGreaterThan(layout.rect.y);
    expect(pin.anchor.y).toBeLessThan(layout.rect.y + layout.rect.height);
    expect([layout.rect.x, layout.rect.x + layout.rect.width]).toContain(pin.anchor.x);
  }
};

describe("layoutOf pin anchors", () => {
  it("pin anchors sit on the PIN_CELL lattice", () => {
    const chips = [
      savedChip("T", [["a"], ["b"], ["c"]], [["x"], ["y"]]),
      savedChip("B", [["d", 4], ["e"]], [["f"]]),
    ];
    for (const chip of chips) {
      expectOnLattice(customLayout(chip));
    }
  });

  it("keeps the NAND anchors where they were", () => {
    const layout = layoutOf(sourceWith([]), piece({ type: "nand" }, { x: 0, y: 100 }));
    expect(layout.pins.map((pin) => pin.anchor.y)).toEqual([120, 160, 140]);
  });
});

describe("layoutOf built-ins", () => {
  it("NAND: a and b on the left, out on the right", () => {
    const layout = layoutOf(sourceWith([]), piece({ type: "nand" }, { x: 40, y: 80 }));
    expect(layout.title).toBe("NAND");
    expect(layout.rect).toEqual({ x: 40, y: 80, width: 3 * GRID, height: 2 * GRID });
    expect(layout.pins.map((pin) => [pin.key, pin.label, pin.side])).toEqual([
      [0, "a", "left"],
      [1, "b", "left"],
      [2, "out", "right"],
    ]);
  });

  it("clock: one output", () => {
    const layout = layoutOf(sourceWith([]), piece({ type: "clock" }));
    expect(layout.pins.map((pin) => [pin.key, pin.side])).toEqual([[0, "right"]]);
  });

  it("split n: the bus in on the left, bits 0..n-1 out on the right", () => {
    const layout = layoutOf(sourceWith([]), piece({ type: "split", width: 4 }));
    expect(layout.pins.map((pin) => [pin.key, pin.label])).toEqual([
      [0, "in[4]"],
      [1, "0"],
      [2, "1"],
      [3, "2"],
      [4, "3"],
    ]);
    expect(layout.rect.height).toBe(8 * PIN_CELL);
  });

  it("merge n: bits 0..n-1 in on the left, the bus out on the right", () => {
    const layout = layoutOf(sourceWith([]), piece({ type: "merge", width: 8 }));
    expect(layout.pins.at(-1)).toMatchObject({ key: 8, label: "out[8]", side: "right" });
    expect(layout.pins.filter((pin) => pin.side === "left")).toHaveLength(8);
  });
});

describe("layoutOf pin pieces", () => {
  it("an input drives from its right edge, an output is entered from its left", () => {
    const input = pinDef("A", "input");
    const output = pinDef("Q", "output", 8);
    const circuit: Circuit = { pins: [input, output], instances: [], wires: [] };
    const source = sourceWith([], circuit);
    const inLayout = layoutOf(source, pinPiece(input));
    const outLayout = layoutOf(source, pinPiece(output));
    expect(inLayout.rect).toEqual({ x: 0, y: 0, width: GRID, height: GRID });
    expect(inLayout.pins).toMatchObject([{ side: "right", label: "A", anchor: { x: GRID } }]);
    expect(outLayout.rect).toMatchObject({ width: GRID, height: 4 * PIN_CELL });
    expect(outLayout.pins).toMatchObject([{ side: "left", label: "Q[8]", anchor: { x: 0 } }]);
  });

  it("a wide input is two grids wide, grown to the left so its pin stays put", () => {
    const input = pinDef("A", "input", 8);
    const source = sourceWith([], { pins: [input], instances: [], wires: [] });
    const layout = layoutOf(source, pinPiece(input));
    expect(layout.rect).toEqual({ x: -GRID, y: 0, width: GRID + GRID, height: 4 * PIN_CELL });
    expect(layout.pins).toMatchObject([{ side: "right", anchor: { x: GRID } }]);
  });

  it("a piece without a definition has no pins", () => {
    const layout = layoutOf(sourceWith([]), piece({ type: "pin", pinId: newPinId() }));
    expect(layout.pins).toEqual([]);
  });
});

describe("createLayoutCache", () => {
  it("reuses a layout until its instance or what it depends on changes", () => {
    const chip = savedChip("C", [["a"]], [["y"]]);
    const source = sourceWith([chip]);
    const custom = piece({ type: "custom", chipId: chip.id });
    const nand = piece({ type: "nand" });
    const layout = createLayoutCache();
    expect(layout(source, custom)).toBe(layout(source, custom));
    expect(layout(source, nand)).toBe(layout(source, nand));
    const renamed: LayoutSource = {
      ...source,
      project: {
        ...source.project,
        chips: source.project.chips.map((item) =>
          item.id === chip.id ? { ...item, name: "Renamed" } : item,
        ),
      },
    };
    expect(layout(renamed, custom).title).toBe("Renamed");
    expect(layout(source, { ...nand, position: { x: GRID, y: 0 } }).rect.x).toBe(GRID);
  });
});
