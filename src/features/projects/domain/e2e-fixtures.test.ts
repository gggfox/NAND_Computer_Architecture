/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { newChip, pinDef, pinPiece, piece, projectWith, wire } from "./builders";
import { parseProjectFile, serializeProject } from "./format";
import type { Project } from "./model";

/*
 * Generates the E2E fixtures in `e2e/fixtures/` from the real builders and checks that each
 * committed file is still what they produce and that it parses through the import path.
 * Regenerate them with
 * `UPDATE_E2E_FIXTURES=1 pnpm vitest run src/features/projects/domain/e2e-fixtures.test.ts`.
 */

const FIXTURES = path.join(import.meta.dirname, "..", "..", "..", "..", "e2e", "fixtures");
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gu;
const HEX = 16;
const ID_DIGITS = 12;
const BUS_WIDTH = 4;
const SEED = 7;
const BUS_IDS = 0x2_00;
const SAVED_IDS = 0x3_00;
const SAVE_FLOW_IDS = 0x5_00;
const RAM_CELL_IDS = 0x6_00;
const BIT_BUS_IDS = 0x7_00;
const BIT_BUS_OUTPUTS = 4;
const ROW = 80;

/** A 4-bit input D (its pin at world (40, 80)), a NAND at (160, 40) and an output; no wires. */
const busProject = (): Project => {
  const bus = pinDef("D", "input", BUS_WIDTH);
  const out = pinDef("OUT", "output");
  const draft = {
    pins: [bus, out],
    instances: [
      pinPiece(bus, { x: 0, y: 40 }),
      piece({ type: "nand" }, { x: 160, y: 40 }),
      pinPiece(out, { x: 320, y: 40 }),
    ],
    wires: [],
  };
  return projectWith("Bus", [newChip("Main", draft)], SEED);
};

/**
 * `Main` (open) holds one instance of `Inner` at (160, 40). `Inner` is saved, with inputs X and Y
 * in that order, and its draft is the same, so a reorder inside it changes only the draft.
 */
const savedChipProject = (): Project => {
  const first = pinDef("X", "input");
  const second = pinDef("Y", "input");
  const inner = newChip(
    "Inner",
    {
      pins: [first, second],
      instances: [pinPiece(first, { x: 0, y: 0 }), pinPiece(second, { x: 0, y: 80 })],
      wires: [],
    },
    { saved: true },
  );
  const main = newChip("Main", {
    pins: [],
    instances: [piece({ type: "custom", chipId: inner.id }, { x: 160, y: 40 })],
    wires: [],
  });
  return projectWith("Saved chip", [main, inner], SEED);
};

/**
 * `Half adder` (open) is saved, with inputs A and B into a NAND (at (160, 40)) and output S.
 * `Full adder` is saved and places it at (160, 40), wiring its inputs X and Y to A and B, so a
 * save of Half adder without B drops one wire there. `Scratch` is draft only.
 */
const saveFlowProject = (): Project => {
  const [inA, inB, outS] = [pinDef("A", "input"), pinDef("B", "input"), pinDef("S", "output")];
  const halfPieces = [
    pinPiece(inA, { x: 0, y: 0 }),
    pinPiece(inB, { x: 0, y: 80 }),
    piece({ type: "nand" }, { x: 160, y: 40 }),
    pinPiece(outS, { x: 320, y: 40 }),
  ] as const;
  const [pieceA, pieceB, nand, pieceS] = halfPieces;
  const half = newChip(
    "Half adder",
    {
      pins: [inA, inB, outS],
      instances: halfPieces,
      wires: [
        wire({ instanceId: pieceA.id, pin: 0 }, { instanceId: nand.id, pin: 0 }),
        wire({ instanceId: pieceB.id, pin: 0 }, { instanceId: nand.id, pin: 1 }),
        wire({ instanceId: nand.id, pin: 2 }, { instanceId: pieceS.id, pin: 0 }),
      ],
    },
    { saved: true, color: "#22c55e" },
  );
  const [inX, inY] = [pinDef("X", "input"), pinDef("Y", "input")];
  const [pieceX, pieceY] = [pinPiece(inX, { x: 0, y: 0 }), pinPiece(inY, { x: 0, y: 80 })];
  const placed = piece({ type: "custom", chipId: half.id }, { x: 160, y: 40 });
  const full = newChip(
    "Full adder",
    {
      pins: [inX, inY],
      instances: [pieceX, pieceY, placed],
      wires: [
        wire({ instanceId: pieceX.id, pin: 0 }, { instanceId: placed.id, pin: inA.id }),
        wire({ instanceId: pieceY.id, pin: 0 }, { instanceId: placed.id, pin: inB.id }),
      ],
    },
    { saved: true, color: "#22c55e" },
  );
  return projectWith("Save flow", [half, full, newChip("Scratch")], SEED);
};

/**
 * `Main` (open) holds one `Cell` at (160, 0) and a 1-bit input `clk` at (0, 0). `Cell` is saved,
 * with inputs `d` and `clk` and output `q`; inside, a NAND of the two inputs.
 */
const ramCellProject = (): Project => {
  const [inD, inClk, outQ] = [pinDef("d", "input"), pinDef("clk", "input"), pinDef("q", "output")];
  const [pieceD, pieceClk, nand, pieceQ] = [
    pinPiece(inD, { x: 0, y: 0 }),
    pinPiece(inClk, { x: 0, y: 80 }),
    piece({ type: "nand" }, { x: 160, y: 40 }),
    pinPiece(outQ, { x: 320, y: 40 }),
  ] as const;
  const cell = newChip(
    "Cell",
    {
      pins: [inD, inClk, outQ],
      instances: [pieceD, pieceClk, nand, pieceQ],
      wires: [
        wire({ instanceId: pieceD.id, pin: 0 }, { instanceId: nand.id, pin: 0 }),
        wire({ instanceId: pieceClk.id, pin: 0 }, { instanceId: nand.id, pin: 1 }),
        wire({ instanceId: nand.id, pin: 2 }, { instanceId: pieceQ.id, pin: 0 }),
      ],
    },
    { saved: true, color: "#22c55e" },
  );
  const clk = pinDef("clk", "input");
  const main = newChip("Main", {
    pins: [clk],
    instances: [
      pinPiece(clk, { x: 0, y: 0 }),
      piece({ type: "custom", chipId: cell.id }, { x: 160, y: 0 }),
    ],
    wires: [],
  });
  return projectWith("RAM cell", [main, cell], SEED);
};

/** A 4-bit input `D` (its pin at world (40, 80)) and four 1-bit outputs at x = 320; no wires. */
const bitBusProject = (): Project => {
  const bus = pinDef("D", "input", BUS_WIDTH);
  const outs = Array.from({ length: BIT_BUS_OUTPUTS }, (_unused, index) =>
    pinDef(`O${String(index)}`, "output"),
  );
  const instances = [pinPiece(bus, { x: 0, y: 40 })];
  for (const [index, out] of outs.entries()) {
    instances.push(pinPiece(out, { x: 320, y: index * ROW }));
  }
  const draft = { pins: [bus, ...outs], instances, wires: [] };
  return projectWith("Bit bus", [newChip("Main", draft)], SEED);
};

/** Random ids replaced, in order of appearance, by fixed ones from `base`, so a file is reproducible. */
const withFixedIds = (text: string, base: number): string => {
  const ids = new Map<string, string>();
  return text.replaceAll(UUID, (id) => {
    const known = ids.get(id);
    if (known !== undefined) {
      return known;
    }
    const fixed = `00000000-0000-4000-8000-${(base + ids.size).toString(HEX).padStart(ID_DIGITS, "0")}`;
    ids.set(id, fixed);
    return fixed;
  });
};

const FIXTURE_CASES = [
  { file: "bus.json", build: busProject, idBase: BUS_IDS },
  { file: "saved-chip.json", build: savedChipProject, idBase: SAVED_IDS },
  { file: "save-flow.json", build: saveFlowProject, idBase: SAVE_FLOW_IDS },
  { file: "ram-cell.json", build: ramCellProject, idBase: RAM_CELL_IDS },
  { file: "bit-bus.json", build: bitBusProject, idBase: BIT_BUS_IDS },
] as const;

describe("the E2E fixtures", () => {
  test.each(FIXTURE_CASES)("$file is what the builders produce, and it imports", (fixture) => {
    const target = path.join(FIXTURES, fixture.file);
    const generated = `${withFixedIds(serializeProject(fixture.build()), fixture.idBase)}\n`;
    if (process.env["UPDATE_E2E_FIXTURES"] === "1") {
      writeFileSync(target, generated);
    }
    const committed = readFileSync(target, "utf-8");
    expect(committed).toBe(generated);
    expect(parseProjectFile(committed).ok).toBe(true);
  });
});
