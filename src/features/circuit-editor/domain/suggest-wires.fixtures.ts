/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { newChip, pinDef, piece, pinPiece, projectWith, wire } from "~/features/projects";
import type { Chip, ChipInstance, Circuit, PinDef, Project, Wire } from "~/features/projects";

import { createLayoutCache } from "./chip-layout";
import type { Scene } from "./geometry";

const BITS = 4;
const NAND_OUT = 2;
const ROW = 120;
const LOAD_ROW = 80;
const REG_X = 240;
const LOADS_FROM = 2;
const FILE_X = 480;
const FILE_ROW = 240;

const range = (count: number): readonly number[] =>
  Array.from({ length: count }, (_unused, index) => index);

const inputs = (prefix: string, count: number): readonly PinDef[] =>
  range(count).map((index) => pinDef(`${prefix}${String(index)}`, "input"));

/** The saved `Reg` chip and its pin definitions, which custom parts address by id. */
export interface RegChip {
  readonly chip: Chip;
  readonly d: readonly PinDef[];
  readonly load: PinDef;
  readonly clk: PinDef;
  readonly q: readonly PinDef[];
}

const ORIGIN = { x: 0, y: 0 };
const OUT_X = 480;

/** One bit of `Reg`: its two pins and the pieces and wires between them. */
const regBit = (index: number, loadPiece: ChipInstance) => {
  const [din, qDef] = [pinDef(`d${String(index)}`, "input"), pinDef(`q${String(index)}`, "output")];
  const [dIn, nand, qPiece] = [
    pinPiece(din, { x: 0, y: index * ROW }),
    piece({ type: "nand" }, { x: REG_X, y: index * ROW }),
    pinPiece(qDef, { x: OUT_X, y: index * ROW }),
  ] as const;
  return {
    din,
    qDef,
    parts: [dIn, nand, qPiece],
    wires: [
      wire({ instanceId: dIn.id, pin: 0 }, { instanceId: nand.id, pin: 0 }),
      wire({ instanceId: loadPiece.id, pin: 0 }, { instanceId: nand.id, pin: 1 }),
      wire({ instanceId: nand.id, pin: NAND_OUT }, { instanceId: qPiece.id, pin: 0 }),
    ],
  };
};

/** `Reg`: saved, inputs `d0`..`d3`, `load`, `clk`; outputs `q0`..`q3`; one NAND per bit inside. */
export const regChip = (): RegChip => {
  const [load, clk] = [pinDef("load", "input"), pinDef("clk", "input")] as const;
  const loadPiece = pinPiece(load, { x: 0, y: BITS * ROW });
  const clkPiece = pinPiece(clk, { x: 0, y: (BITS + 1) * ROW });
  const rows = range(BITS).map((index) => regBit(index, loadPiece));
  const d = rows.map((row) => row.din);
  const q = rows.map((row) => row.qDef);
  const circuit: Circuit = {
    pins: [...d, load, clk, ...q],
    instances: [...rows.flatMap((row) => row.parts), loadPiece, clkPiece],
    wires: rows.flatMap((row) => row.wires),
  };
  return { chip: newChip("Reg", circuit, { saved: true }), d, load, clk, q };
};

const sceneOf = (project: Project, circuit: Circuit): Scene => ({
  project,
  circuit,
  layout: createLayoutCache(),
});

/** `Main` open with `circuit`, `Reg` saved beside it. */
const mainScene = (reg: RegChip, circuit: Circuit): Scene =>
  sceneOf(projectWith("suggest", [newChip("Main", circuit), reg.chip]), circuit);

const regPart = (reg: RegChip, x: number, y: number): ChipInstance =>
  piece({ type: "custom", chipId: reg.chip.id }, { x, y });

export interface RegisterFile {
  readonly scene: Scene;
  readonly reg: RegChip;
  /** The 4-bit input `d`. */
  readonly d: ChipInstance;
  readonly clk: ChipInstance;
  /** The 1-bit inputs `load0`..`load3`, with their pin definitions. */
  readonly loads: readonly ChipInstance[];
  readonly loadPins: readonly PinDef[];
  /** The four `Reg` parts, top to bottom. */
  readonly regs: readonly ChipInstance[];
}

/** `Main`: 4-bit input `d`, input `clk`, inputs `load0`..`load3`, four `Reg` parts; no wires. */
export const registerFileScene = (): RegisterFile => {
  const reg = regChip();
  const [dPin, clkPin] = [pinDef("d", "input", BITS), pinDef("clk", "input")] as const;
  const loadPins = inputs("load", BITS);
  const [d, clk] = [pinPiece(dPin, { x: 0, y: 0 }), pinPiece(clkPin, { x: 0, y: LOAD_ROW })];
  const loads = loadPins.map((pin, index) =>
    pinPiece(pin, { x: 0, y: (index + LOADS_FROM) * LOAD_ROW }),
  );
  const regs = range(BITS).map((index) => regPart(reg, FILE_X, index * FILE_ROW));
  const circuit: Circuit = {
    pins: [dPin, clkPin, ...loadPins],
    instances: [d, clk, ...loads, ...regs],
    wires: [],
  };
  return { scene: mainScene(reg, circuit), reg, d, clk, loads, loadPins, regs };
};

const REGS = 40;
const NANDS = 150;
const REG_COLUMNS = 8;
const NAND_COLUMNS = 15;
const REG_STEP = { x: 240, y: 320 };
const NAND_STEP = { x: 120, y: 100 };
const NAND_TOP = 2000;
const EXTRA_PINS = 4;
const FAN_SKIP = 7;
const UNWIRED_EVERY = 3;

export interface BigScene {
  readonly scene: Scene;
  readonly reg: RegChip;
  readonly d: ChipInstance;
  readonly clk: ChipInstance;
  readonly regs: readonly ChipInstance[];
  readonly nands: readonly ChipInstance[];
}

const gridAt = (index: number, columns: number) => ({
  column: index % columns,
  row: Math.floor(index / columns),
});

/** NAND input `a` fed by another NAND, except every third NAND, whose inputs stay free. */
const nandWires = (nands: readonly ChipInstance[]): readonly Wire[] =>
  nands.flatMap((nand, index) => {
    const source = nands[(index + FAN_SKIP) % nands.length];
    return source === undefined || index % UNWIRED_EVERY === UNWIRED_EVERY - 1
      ? []
      : [wire({ instanceId: source.id, pin: NAND_OUT }, { instanceId: nand.id, pin: 0 })];
  });

/** The 4-bit `d`, `clk` and 8 more pin pieces, down the left edge. */
const bigPins = () => {
  const [dPin, clkPin] = [pinDef("d", "input", BITS), pinDef("clk", "input")] as const;
  const outs = range(EXTRA_PINS).map((index) => pinDef(`out${String(index)}`, "output"));
  const extras = [...inputs("in", EXTRA_PINS), ...outs];
  const [d, clk] = [pinPiece(dPin, ORIGIN), pinPiece(clkPin, { x: 0, y: LOAD_ROW })] as const;
  const rest = extras.map((pin, index) =>
    pinPiece(pin, { x: 0, y: (index + LOADS_FROM) * LOAD_ROW }),
  );
  return { pins: [dPin, clkPin, ...extras], parts: [d, clk, ...rest], d, clk };
};

const bigParts = (reg: RegChip) => ({
  regs: range(REGS).map((index) => {
    const { column, row } = gridAt(index, REG_COLUMNS);
    return regPart(reg, REG_X + column * REG_STEP.x, row * REG_STEP.y);
  }),
  nands: range(NANDS).map((index) => {
    const { column, row } = gridAt(index, NAND_COLUMNS);
    return piece({ type: "nand" }, { x: column * NAND_STEP.x, y: NAND_TOP + row * NAND_STEP.y });
  }),
});

/** 200 parts: 40 `Reg`, 150 NANDs, `d`[4], `clk` and 8 more pin pieces; a third of the NANDs wired. */
export const bigScene = (): BigScene => {
  const reg = regChip();
  const { pins, parts, d, clk } = bigPins();
  const { regs, nands } = bigParts(reg);
  const circuit: Circuit = {
    pins,
    instances: [...parts, ...regs, ...nands],
    wires: nandWires(nands),
  };
  return { scene: mainScene(reg, circuit), reg, d, clk, regs, nands };
};
