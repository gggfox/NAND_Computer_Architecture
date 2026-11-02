/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { createDemoProject, EMPTY_CIRCUIT, pinDef, pinPiece, piece } from "~/features/projects";
import type { Circuit, Point } from "~/features/projects";

import { GRID, layoutOfKind } from "./chip-layout";
import type { Scene } from "./geometry";
import { columnPositions, nextPinNames, PIN_COLUMN_GAP, PIN_ROW_GAP } from "./pin-placement";

const LETTERS = 26;
const NIBBLE = 4;

const demoScene = (): Scene => {
  const project = createDemoProject("x");
  return { project, circuit: project.chips[0]?.draft ?? EMPTY_CIRCUIT };
};

const sceneWith = (circuit: Circuit): Scene => ({ project: demoScene().project, circuit });

const circuitOf = (names: readonly string[], direction: "input" | "output"): Circuit => ({
  ...EMPTY_CIRCUIT,
  pins: names.map((name) => pinDef(name, direction)),
});

const onGrid = (points: readonly Point[]): boolean =>
  points.every((point) => point.x % GRID === 0 && point.y % GRID === 0);

describe("pin gaps", () => {
  it("stack a grid step apart and keep two steps from other parts", () => {
    expect(PIN_ROW_GAP).toBe(GRID);
    expect(PIN_COLUMN_GAP).toBe(2 * GRID);
  });
});

describe("nextPinNames", () => {
  it("names inputs by letter and outputs by number on an empty circuit", () => {
    expect(nextPinNames(EMPTY_CIRCUIT, "input", 3)).toEqual(["A", "B", "C"]);
    expect(nextPinNames(EMPTY_CIRCUIT, "output", 2)).toEqual(["OUT1", "OUT2"]);
  });

  it("skips names used by a pin of either direction", () => {
    const circuit: Circuit = {
      ...EMPTY_CIRCUIT,
      pins: [pinDef("A", "input"), pinDef("C", "input"), pinDef("OUT1", "output")],
    };
    expect(nextPinNames(circuit, "input", 2)).toEqual(["B", "D"]);
    expect(nextPinNames(circuit, "output", 1)).toEqual(["OUT2"]);
  });

  it("skips a name an output already holds", () => {
    expect(nextPinNames(circuitOf(["A", "B"], "output"), "input", 1)).toEqual(["C"]);
  });

  it("compares names case-sensitively", () => {
    expect(nextPinNames(circuitOf(["a", "out1"], "input"), "input", 1)).toEqual(["A"]);
    expect(nextPinNames(circuitOf(["a", "out1"], "input"), "output", 1)).toEqual(["OUT1"]);
  });

  it("goes on to two letters after Z, like spreadsheet columns", () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    expect(nextPinNames(circuitOf(letters, "input"), "input", 1)).toEqual(["AA"]);
    expect(nextPinNames(circuitOf([...letters, "AA"], "input"), "input", 2)).toEqual(["AB", "AC"]);
  });

  it("goes on to three letters after ZZ", () => {
    const names = nextPinNames(EMPTY_CIRCUIT, "input", LETTERS + LETTERS * LETTERS + 1);
    expect(names.at(LETTERS - 1)).toBe("Z");
    expect(names.at(LETTERS + LETTERS - 1)).toBe("AZ");
    expect(names.at(-2)).toBe("ZZ");
    expect(names.at(-1)).toBe("AAA");
  });

  it("gives nothing for a count of 0", () => {
    expect(nextPinNames(EMPTY_CIRCUIT, "input", 0)).toEqual([]);
  });
});

describe("columnPositions below a column", () => {
  it("stacks new inputs below the lowest input of the demo", () => {
    const points = columnPositions(demoScene(), "input", [1, 1]);
    expect(points).toEqual([
      { x: 0, y: 160 },
      { x: 0, y: 240 },
    ]);
  });

  it("stacks below the lowest piece wherever it sits in the list", () => {
    const low = pinDef("A", "input");
    const high = pinDef("B", "input");
    const scene = sceneWith({
      pins: [low, high],
      instances: [pinPiece(low, { x: 80, y: 200 }), pinPiece(high, { x: 0, y: 0 })],
      wires: [],
    });
    expect(columnPositions(scene, "input", [1])).toEqual([{ x: 80, y: 280 }]);
  });

  it("stacks new outputs below the lowest output, at its x", () => {
    expect(columnPositions(demoScene(), "output", [1])).toEqual([{ x: 320, y: 120 }]);
  });
});

describe("columnPositions in a new column", () => {
  it("starts an output column right of the rightmost part, at the parts' top", () => {
    const scene = sceneWith({
      ...EMPTY_CIRCUIT,
      instances: [piece({ type: "nand" }, { x: 160, y: 40 })],
    });
    const nandWidth = layoutOfKind(scene, { type: "nand" }, { x: 0, y: 0 }).rect.width;
    const points = columnPositions(scene, "output", [1]);
    expect(points).toEqual([{ x: Math.round((160 + nandWidth + 80) / GRID) * GRID, y: 40 }]);
  });

  it("starts an input column a gap and a piece left of the leftmost part", () => {
    const scene = sceneWith({
      ...EMPTY_CIRCUIT,
      instances: [
        piece({ type: "nand" }, { x: 160, y: 120 }),
        piece({ type: "nand" }, { x: 400, y: 40 }),
      ],
    });
    expect(columnPositions(scene, "input", [1, 1])).toEqual([
      { x: 40, y: 40 },
      { x: 40, y: 120 },
    ]);
  });

  it("ignores pins of the other direction when starting a column", () => {
    const def = pinDef("A", "input");
    const scene = sceneWith({
      pins: [def],
      instances: [pinPiece(def, { x: -400, y: 400 }), piece({ type: "nand" }, { x: 160, y: 40 })],
      wires: [],
    });
    const nandWidth = layoutOfKind(scene, { type: "nand" }, { x: 0, y: 0 }).rect.width;
    expect(columnPositions(scene, "output", [1])).toEqual([
      { x: Math.round((160 + nandWidth + 80) / GRID) * GRID, y: 40 },
    ]);
  });

  it("starts at the origin for inputs and six steps right for outputs with no parts", () => {
    const scene = sceneWith(EMPTY_CIRCUIT);
    expect(columnPositions(scene, "input", [1, NIBBLE])).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 80 },
    ]);
    expect(columnPositions(scene, "output", [1])).toEqual([{ x: 6 * GRID, y: 0 }]);
  });
});

describe("columnPositions on the grid", () => {
  it("keeps a bus piece clear of the next one by snapping down", () => {
    const points = columnPositions(sceneWith(EMPTY_CIRCUIT), "input", [NIBBLE, 1]);
    // A 4-bit piece is 60 high: 60 + 40 = 100 snaps to 120.
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 120 },
    ]);
  });

  it("snaps an off-grid column start to the grid", () => {
    const def = pinDef("OUT", "output");
    const scene = sceneWith({
      pins: [def],
      instances: [pinPiece(def, { x: 330, y: 50 })],
      wires: [],
    });
    expect(columnPositions(scene, "output", [1])).toEqual([{ x: 320, y: 120 }]);
  });

  it("gives nothing for no widths", () => {
    expect(columnPositions(demoScene(), "input", [])).toEqual([]);
  });

  it("puts every point on the grid", () => {
    const widths = [1, NIBBLE, 8, 16, 1] as const;
    const demo = demoScene();
    const empty = sceneWith(EMPTY_CIRCUIT);
    expect(onGrid(columnPositions(demo, "input", widths))).toBe(true);
    expect(onGrid(columnPositions(demo, "output", widths))).toBe(true);
    expect(onGrid(columnPositions(empty, "output", widths))).toBe(true);
  });
});
