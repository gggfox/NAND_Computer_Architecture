import { describe, expect, it } from "vitest";

import { newChip, piece, projectWith, wire } from "~/features/projects";
import type { Chip } from "~/features/projects";
import { newChipId } from "~/shared/ids";

import {
  end,
  errorOf,
  io,
  NAND_OUT,
  nandPart,
  NIBBLE,
  notHost,
  placing,
  single,
  withChip,
} from "./to-netlist-source.fixtures";

describe("flattening errors: wiring", () => {
  it("unconnected NAND input", () => {
    const pins = io(["A"], ["Y"]);
    const [pieceA, pieceY] = [pins.piece("A"), pins.piece("Y")];
    const nand = nandPart();
    const wires = [wire(end(pieceA), end(nand, 0)), wire(end(nand, NAND_OUT), end(pieceY))];
    const { project, host } = single({ pins, parts: [nand], wires });
    expect(errorOf(project, host.id)).toEqual({
      type: "UnconnectedPin",
      path: [],
      instanceId: nand.id,
      pin: 1,
      bit: 0,
    });
  });

  it("unconnected pin inside a chip carries the path", () => {
    const { project, host, not, instance } = notHost();
    const saved = { ...not.chip.draft, wires: not.chip.draft.wires.slice(1) };
    expect(errorOf(withChip(project, { ...not.chip, saved }), host.id)).toEqual({
      type: "UnconnectedPin",
      path: [instance.id],
      instanceId: not.nand.id,
      pin: 0,
      bit: 0,
    });
  });

  it("an unconnected custom input reports the instance in its parent", () => {
    const { project, host, not, instance } = notHost();
    const draft = { ...host.draft, wires: host.draft.wires.slice(1) };
    expect(errorOf(withChip(project, { ...host, draft }), host.id)).toEqual({
      type: "UnconnectedPin",
      path: [],
      instanceId: instance.id,
      pin: not.pinIn.id,
      bit: 0,
    });
  });
});

describe("flattening errors: loops and stored wires", () => {
  it("a wire loop through SPLIT/MERGE", () => {
    const pins = io([], ["Y"]);
    const split = piece({ type: "split", width: NIBBLE });
    const merge = piece({ type: "merge", width: NIBBLE });
    const wires = [
      wire(end(merge, NIBBLE), end(split, 0), NIBBLE),
      ...[1, 2, 3, 4].map((out) => wire(end(split, out), end(merge, out - 1))),
      wire(end(split, 1), end(pins.piece("Y"))),
    ];
    const { project, host } = single({ pins, parts: [split, merge], wires });
    expect(errorOf(project, host.id)).toEqual({ type: "WireLoop", path: [], instanceId: split.id });
  });

  it("a stored-backwards wire", () => {
    const pins = io(["A"], ["Y"]);
    const backwards = wire(end(pins.piece("Y")), end(pins.piece("A")));
    const { project, host } = single({ pins, wires: [backwards] });
    expect(errorOf(project, host.id)).toEqual({
      type: "InvalidWire",
      path: [],
      wireId: backwards.id,
    });
  });
});

describe("flattening errors: chips", () => {
  it("draft-only nested chip", () => {
    const draftOnly = newChip("D");
    const host = placing(draftOnly.id);
    expect(errorOf(projectWith("p", [host, draftOnly]), host.id)).toEqual({
      type: "ChipNotSaved",
      chipId: draftOnly.id,
    });
  });

  it("missing nested or open chip", () => {
    const chipId = newChipId();
    const host = placing(chipId);
    const project = projectWith("p", [host]);
    expect(errorOf(project, host.id)).toEqual({ type: "ChipNotFound", chipId });
    const openId = newChipId();
    expect(errorOf(project, openId)).toEqual({ type: "ChipNotFound", chipId: openId });
  });

  it("a recursive chip from a file terminates", () => {
    const chipId = newChipId();
    const self = placing(chipId);
    const chipA: Chip = { ...self, id: chipId, saved: self.draft };
    const host = placing(chipId);
    const project = projectWith("p", [host, chipA]);
    expect(errorOf(project, host.id)).toEqual({ type: "RecursiveChip", chipId });
    expect(errorOf(project, chipId)).toEqual({ type: "RecursiveChip", chipId });
  });
});
