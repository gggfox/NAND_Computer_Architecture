import { expect } from "vitest";

import { newChip, pinDef, pinPiece, piece, projectWith, wire } from "~/features/projects";
import type {
  BitWidth,
  Chip,
  ChipInstance,
  PinDef,
  PinDirection,
  PinKey,
  PinRef,
  Project,
  Wire,
} from "~/features/projects";
import type { NetlistSource } from "~/features/simulation";
import type { ChipId } from "~/shared/ids";

import type { EditorAction } from "./actions";
import { applyAction } from "./reducer";
import { toNetlistSource } from "./to-netlist-source";
import type { NetlistSourceError } from "./to-netlist-source";

export const NAND_OUT = 2;
export const NIBBLE = 4;

export const input = (index: number) => ({ kind: "input", index }) as const;
export const nandRef = (index: number) => ({ kind: "nand", index }) as const;
export const CLOCK = { kind: "clock" } as const;

export const pick = <T>(items: readonly T[], index: number): T => {
  const found = items[index];
  if (found === undefined) {
    expect.unreachable(`fixture item ${String(index)} exists`);
  }
  return found;
};

export const end = (instance: ChipInstance, pin: PinKey = 0, bit?: number): PinRef =>
  bit === undefined ? { instanceId: instance.id, pin } : { instanceId: instance.id, pin, bit };

/** A chip's pins (inputs first) and their pieces, also looked up by pin name. */
interface Io {
  readonly defs: readonly PinDef[];
  readonly pieces: readonly ChipInstance[];
  readonly def: (name: string) => PinDef;
  readonly piece: (name: string) => ChipInstance;
}

/** A 1-bit pin by name, or `[name, width]`. */
type PinSpec = string | readonly [string, BitWidth];

const defsOf = (specs: readonly PinSpec[], direction: PinDirection): readonly PinDef[] =>
  specs.map((spec) =>
    typeof spec === "string" ? pinDef(spec, direction) : pinDef(spec[0], direction, spec[1]),
  );

export const io = (inputs: readonly PinSpec[], outputs: readonly PinSpec[] = []): Io => {
  const defs = [...defsOf(inputs, "input"), ...defsOf(outputs, "output")];
  const pieces = defs.map((def) => pinPiece(def));
  const indexOf = (name: string): number => defs.findIndex((def) => def.name === name);
  return {
    defs,
    pieces,
    def: (name) => pick(defs, indexOf(name)),
    piece: (name) => pick(pieces, indexOf(name)),
  };
};

interface ChipSpec {
  readonly pins: Io;
  readonly parts?: readonly ChipInstance[];
  readonly wires: readonly Wire[];
  readonly saved?: boolean;
}

const chipOf = (name: string, spec: ChipSpec): Chip =>
  newChip(
    name,
    {
      pins: spec.pins.defs,
      instances: [...spec.pins.pieces, ...(spec.parts ?? [])],
      wires: spec.wires,
    },
    { saved: spec.saved ?? false },
  );

const custom = (chip: Chip): ChipInstance => piece({ type: "custom", chipId: chip.id });

export const nandPart = (): ChipInstance => piece({ type: "nand" });

export const sourceOf = (project: Project, chipId: ChipId): NetlistSource | undefined => {
  const result = toNetlistSource(project, chipId);
  return result.ok ? result.value.source : undefined;
};

export const errorOf = (project: Project, chipId: ChipId): NetlistSourceError | undefined => {
  const result = toNetlistSource(project, chipId);
  return result.ok ? undefined : result.error;
};

export const act = (project: Project, ...actions: readonly EditorAction[]): Project =>
  actions.reduce((current, action) => {
    const result = applyAction(current, action);
    expect(result.ok).toBe(true);
    return result.ok ? result.value : current;
  }, project);

export const withChip = (project: Project, chip: Chip): Project => ({
  ...project,
  chips: project.chips.map((item) => (item.id === chip.id ? chip : item)),
});

/** NOT = NAND(a, a): pins a (in) and y (out). */
export const notChip = () => {
  const pins = io(["a"], ["y"]);
  const [pieceA, pieceY] = [pins.piece("a"), pins.piece("y")];
  const nand = nandPart();
  const wires = [
    wire(end(pieceA), end(nand, 0)),
    wire(end(pieceA), end(nand, 1)),
    wire(end(nand, NAND_OUT), end(pieceY)),
  ];
  const chip = chipOf("NOT", { pins, parts: [nand], wires, saved: true });
  return { chip, pinIn: pins.def("a"), pinOut: pins.def("y"), pieceA, pieceY, nand };
};

/** A chip with pins A and Y whose only part is `inner` (one in, one out), wired straight through. */
const wrap = (name: string, inner: Chip, saved = false) => {
  const [innerIn, innerOut] = [pick(inner.draft.pins, 0).id, pick(inner.draft.pins, 1).id];
  const pins = io(["A"], ["Y"]);
  const instance = custom(inner);
  const wires = [
    wire(end(pins.piece("A")), end(instance, innerIn)),
    wire(end(instance, innerOut), end(pins.piece("Y"))),
  ];
  return { chip: chipOf(name, { pins, parts: [instance], wires, saved }), instance };
};

/** Host A -> NOT -> Y. */
export const notHost = () => {
  const not = notChip();
  const { chip: host, instance } = wrap("H", not.chip);
  return { not, host, instance, project: projectWith("p", [host, not.chip]) };
};

/** AND.saved = [n0 NAND(a, b), not1 NOT(n0)]. */
const andChip = (not: ReturnType<typeof notChip>) => {
  const pins = io(["a", "b"], ["y"]);
  const [n0, not1] = [nandPart(), custom(not.chip)];
  const wires = [
    wire(end(pins.piece("a")), end(n0, 0)),
    wire(end(pins.piece("b")), end(n0, 1)),
    wire(end(n0, NAND_OUT), end(not1, not.pinIn.id)),
    wire(end(not1, not.pinOut.id), end(pins.piece("y"))),
  ];
  return { chip: chipOf("AND", { pins, parts: [n0, not1], wires, saved: true }), pins };
};

/** Host = [h0 NAND(A, B), and1 AND(A, B)]; Y <- and1, Z <- h0. */
export const nestedProject = () => {
  const not = notChip();
  const and = andChip(not);
  const pins = io(["A", "B"], ["Y", "Z"]);
  const [h0, and1] = [nandPart(), custom(and.chip)];
  const [fromA, fromB] = [end(pins.piece("A")), end(pins.piece("B"))];
  const wires = [
    wire(fromA, end(h0, 0)),
    wire(fromB, end(h0, 1)),
    wire(fromA, end(and1, and.pins.def("a").id)),
    wire(fromB, end(and1, and.pins.def("b").id)),
    wire(end(and1, and.pins.def("y").id), end(pins.piece("Y"))),
    wire(end(h0, NAND_OUT), end(pins.piece("Z"))),
  ];
  const host = chipOf("H", { pins, parts: [h0, and1], wires });
  return { host, project: projectWith("p", [host, and.chip, not.chip]) };
};

/** NOT inside saved P inside open G. */
export const grandparentProject = () => {
  const not = notChip();
  const parent = wrap("P", not.chip, true).chip;
  const grandparent = wrap("G", parent).chip;
  return { not, grandparent, project: projectWith("p", [grandparent, parent, not.chip]) };
};

/** One open chip with the given pins, parts and wires. */
export const single = (spec: ChipSpec) => {
  const host = chipOf("H", spec);
  return { host, project: projectWith("p", [host]) };
};

/** A clock into NAND(clk, clk) driving `output`. */
const clocked = (output: ChipInstance) => {
  const clock = piece({ type: "clock" });
  const nand = nandPart();
  const wires = [
    wire(end(clock), end(nand, 0)),
    wire(end(clock), end(nand, 1)),
    wire(end(nand, NAND_OUT), end(output)),
  ];
  return { parts: [clock, nand], wires };
};

/** Host: clock NAND -> Y; a saved chip K with its own clock NAND -> Z. */
export const clockProject = () => {
  const innerPins = io([], ["y"]);
  const ticker = chipOf("K", { pins: innerPins, ...clocked(innerPins.piece("y")), saved: true });
  const pins = io([], ["Y", "Z"]);
  const instance = custom(ticker);
  const outer = clocked(pins.piece("Y"));
  const nested = wire(end(instance, innerPins.def("y").id), end(pins.piece("Z")));
  const parts = [...outer.parts, instance];
  const host = chipOf("H", { pins, parts, wires: [...outer.wires, nested] });
  return { host, project: projectWith("p", [host, ticker]) };
};

/** X: y = NAND(a, a), z = b. */
const chipX = () => {
  const pins = io(["a", "b"], ["y", "z"]);
  const nand = nandPart();
  const wires = [
    wire(end(pins.piece("a")), end(nand, 0)),
    wire(end(pins.piece("a")), end(nand, 1)),
    wire(end(nand, NAND_OUT), end(pins.piece("y"))),
    wire(end(pins.piece("b")), end(pins.piece("z"))),
  ];
  return { chip: chipOf("X", { pins, parts: [nand], wires, saved: true }), pins };
};

/** Host wires A, B, Y, Z to X's a, b, y, z. */
export const reorderProject = () => {
  const inner = chipX();
  const pins = io(["A", "B"], ["Y", "Z"]);
  const instance = custom(inner.chip);
  const into = (outer: string, pin: string) =>
    wire(end(pins.piece(outer)), end(instance, inner.pins.def(pin).id));
  const outOf = (pin: string, outer: string) =>
    wire(end(instance, inner.pins.def(pin).id), end(pins.piece(outer)));
  const wires = [into("A", "a"), into("B", "b"), outOf("y", "Y"), outOf("z", "Z")];
  const host = chipOf("H", { pins, parts: [instance], wires });
  const project = projectWith("p", [host, inner.chip]);
  return { chipX: inner.chip, pinB: inner.pins.def("b"), host, project };
};

/** An open chip whose only part is a custom instance of `chipId`. */
export const placing = (chipId: ChipId): Chip =>
  chipOf("H", { pins: io([]), parts: [piece({ type: "custom", chipId })], wires: [] });

/** The project with every chip's draft and saved wires in reverse order. */
export const reverseWires = (project: Project): Project => ({
  ...project,
  chips: project.chips.map((chip) => ({
    ...chip,
    draft: { ...chip.draft, wires: chip.draft.wires.toReversed() },
    ...(chip.saved ? { saved: { ...chip.saved, wires: chip.saved.wires.toReversed() } } : {}),
  })),
});
