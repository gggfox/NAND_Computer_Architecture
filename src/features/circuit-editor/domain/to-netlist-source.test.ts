import { describe, expect, it } from "vitest";

import { createDemoProject, piece, wire } from "~/features/projects";
import type { Wire } from "~/features/projects";
import { newWireId } from "~/shared/ids";

import { toNetlistSource } from "./to-netlist-source";
import {
  act,
  CLOCK,
  clockProject,
  end,
  grandparentProject,
  input,
  io,
  nandRef,
  nestedProject,
  NIBBLE,
  notHost,
  pick,
  reorderProject,
  reverseWires,
  single,
  sourceOf,
} from "./to-netlist-source.fixtures";

/** Each wire's id and ends, without its route. */
const ends = (wires: readonly Wire[] | undefined) =>
  wires?.map((item) => [item.id, item.from, item.to, item.bitWidth]);

describe("toNetlistSource", () => {
  it("the demo flattens to 2 inputs, 1 NAND, 1 output", () => {
    const project = createDemoProject("x");
    expect(sourceOf(project, project.lastOpenedChipId)).toEqual({
      inputCount: 2,
      nands: [{ a: input(0), b: input(1) }],
      outputs: [nandRef(0)],
    });
  });

  it("a saved custom chip flattens into its NANDs", () => {
    const { project, host } = notHost();
    expect(sourceOf(project, host.id)).toEqual({
      inputCount: 1,
      nands: [{ a: input(0), b: input(0) }],
      outputs: [nandRef(0)],
    });
  });

  it("nested chips flatten pre-order in instance order", () => {
    const { project, host } = nestedProject();
    expect(sourceOf(project, host.id)).toEqual({
      inputCount: 2,
      nands: [
        { a: input(0), b: input(1) },
        { a: input(0), b: input(1) },
        { a: nandRef(1), b: nandRef(1) },
      ],
      outputs: [nandRef(2), nandRef(0)],
    });
  });

  it("returns the open chip's IO layout", () => {
    const { project, host } = notHost();
    const result = toNetlistSource(project, host.id);
    const [inputDef, outputDef] = host.draft.pins;
    expect(result.ok && result.value.layout).toEqual({
      inputs: [{ pinId: inputDef?.id, width: 1, offset: 0 }],
      outputs: [{ pinId: outputDef?.id, width: 1, offset: 0 }],
    });
  });
});

describe("toNetlistSource versions", () => {
  it("nested chips run their saved version, the open chip its draft", () => {
    const { project, host, not } = notHost();
    const before = sourceOf(project, host.id);
    const wireId = pick(not.chip.draft.wires, 0).id;
    const edited = act(project, { type: "removeWire", chipId: not.chip.id, wireId });
    expect(sourceOf(edited, host.id)).toEqual(before);
  });

  it("grandparent simulates the new saved version", () => {
    const { not, grandparent, project } = grandparentProject();
    expect(sourceOf(project, grandparent.id)).toEqual({
      inputCount: 1,
      nands: [{ a: input(0), b: input(0) }],
      outputs: [nandRef(0)],
    });
    const chipId = not.chip.id;
    const [from, to] = [end(not.pieceA), end(not.pieceY)];
    const buffer = act(
      project,
      { type: "removeChip", chipId, instanceId: not.nand.id },
      { type: "connectWire", chipId, wireId: newWireId(), from, to },
      { type: "saveChip", chipId },
    );
    expect(sourceOf(buffer, grandparent.id)).toEqual({
      inputCount: 1,
      nands: [],
      outputs: [input(0)],
    });
  });
});

describe("toNetlistSource buses", () => {
  it("bus wires expand bit by bit", () => {
    const pins = io([["D", NIBBLE]], [["Q", NIBBLE]]);
    const bus = [wire(end(pins.piece("D")), end(pins.piece("Q")), NIBBLE)];
    const { project, host } = single({ pins, wires: bus });
    expect(sourceOf(project, host.id)).toEqual({
      inputCount: NIBBLE,
      nands: [],
      outputs: [input(0), input(1), input(2), input(3)],
    });
  });

  it("SPLIT and MERGE are wiring", () => {
    const pins = io([["D", NIBBLE]], [["Q", NIBBLE]]);
    const [pieceD, pieceQ] = [pins.piece("D"), pins.piece("Q")];
    const split = piece({ type: "split", width: NIBBLE });
    const merge = piece({ type: "merge", width: NIBBLE });
    const crossings = [1, 2, 3, 4].map((out) => wire(end(split, out), end(merge, NIBBLE - out)));
    const wires = [
      wire(end(pieceD), end(split, 0), NIBBLE),
      ...crossings,
      wire(end(merge, NIBBLE), end(pieceQ), NIBBLE),
    ];
    const { project, host } = single({ pins, parts: [split, merge], wires });
    expect(sourceOf(project, host.id)).toEqual({
      inputCount: NIBBLE,
      nands: [],
      outputs: [input(3), input(2), input(1), input(0)],
    });
  });
});

const BITS = [0, 1, 2, 3] as const;
const nibbleNames = (prefix: string): readonly string[] =>
  BITS.map((bit) => `${prefix}${String(bit)}`);
const IN_ORDER = { inputCount: NIBBLE, nands: [], outputs: BITS.map((bit) => input(bit)) };

describe("toNetlistSource SPLIT and MERGE bit order", () => {
  it("SPLIT output k carries bus bit k - 1", () => {
    const pins = io([["D", NIBBLE]], nibbleNames("Y"));
    const split = piece({ type: "split", width: NIBBLE });
    const outs = BITS.map((bit) => {
      const target = end(pins.piece(`Y${String(bit)}`));
      return wire(end(split, bit + 1), target);
    });
    const wires = [wire(end(pins.piece("D")), end(split, 0), NIBBLE), ...outs];
    const { project, host } = single({ pins, parts: [split], wires });
    expect(sourceOf(project, host.id)).toEqual(IN_ORDER);
  });

  it("MERGE input n becomes bus bit n", () => {
    const pins = io(nibbleNames("A"), [["Q", NIBBLE]]);
    const merge = piece({ type: "merge", width: NIBBLE });
    const ins = BITS.map((bit) => {
      const from = end(pins.piece(`A${String(bit)}`));
      return wire(from, end(merge, bit));
    });
    const wires = [...ins, wire(end(merge, NIBBLE), end(pins.piece("Q")), NIBBLE)];
    const { project, host } = single({ pins, parts: [merge], wires });
    expect(sourceOf(project, host.id)).toEqual(IN_ORDER);
  });
});

describe("toNetlistSource bit taps", () => {
  it("bit taps pick one bit", () => {
    const pins = io([["D", NIBBLE]], ["Y"]);
    const tap = [wire(end(pins.piece("D"), 0, 2), end(pins.piece("Y")))];
    const { project, host } = single({ pins, wires: tap });
    expect(sourceOf(project, host.id)).toEqual({
      inputCount: NIBBLE,
      nands: [],
      outputs: [input(2)],
    });
  });

  it("bit taps into a bus pin fill one bit each", () => {
    const pins = io(["A", "B"], [["Q", NIBBLE]]);
    const [fromA, fromB, toQ] = [end(pins.piece("A")), end(pins.piece("B")), pins.piece("Q")];
    const taps = [wire(fromA, end(toQ, 0, 0)), wire(fromB, end(toQ, 0, 1))];
    const more = [wire(fromB, end(toQ, 0, 3)), wire(fromA, end(toQ, 0, 2))];
    const { project, host } = single({ pins, wires: [...taps, ...more] });
    expect(sourceOf(project, host.id)).toEqual({
      inputCount: 2,
      nands: [],
      outputs: [input(0), input(1), input(0), input(1)],
    });
  });
});

describe("toNetlistSource structure", () => {
  it("the clock is one shared signal, also inside chips", () => {
    const { project, host } = clockProject();
    expect(sourceOf(project, host.id)).toEqual({
      inputCount: 0,
      nands: [
        { a: CLOCK, b: CLOCK },
        { a: CLOCK, b: CLOCK },
      ],
      outputs: [nandRef(0), nandRef(1)],
    });
  });

  it("reordering a nested chip's pins never rewires", () => {
    const { chipX, pinB, host, project } = reorderProject();
    const before = sourceOf(project, host.id);
    expect(before).toEqual({
      inputCount: 2,
      nands: [{ a: input(0), b: input(0) }],
      outputs: [nandRef(0), input(1)],
    });
    const reordered = act(
      project,
      { type: "reorderPin", chipId: chipX.id, pinId: pinB.id, toIndex: 0 },
      { type: "saveChip", chipId: chipX.id },
    );
    const chips = new Map(reordered.chips.map((chip) => [chip.id, chip]));
    expect(chips.get(chipX.id)?.saved?.pins.map((def) => def.name)).toEqual(["b", "a", "y", "z"]);
    // The fixture's pieces overlap, so the wires are re-routed: compare connections.
    expect(ends(chips.get(host.id)?.draft.wires)).toEqual(ends(host.draft.wires));
    expect(sourceOf(reordered, host.id)).toEqual(before);
  });

  it("flattening does not depend on wire array order", () => {
    const { project, host } = nestedProject();
    expect(sourceOf(reverseWires(project), host.id)).toEqual(sourceOf(project, host.id));
  });
});
