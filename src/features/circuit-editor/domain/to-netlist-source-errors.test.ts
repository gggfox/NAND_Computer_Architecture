import { describe, expect, it } from "vitest";

import { newChip, piece, projectWith, wire } from "~/features/projects";
import type { Chip, ChipInstance, Project } from "~/features/projects";
import { newChipId, newWireId } from "~/shared/ids";

import type { Frame, Walk } from "./flatten-walk";
import { build } from "./to-netlist-source";
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

describe("flattening errors: hand-built projects", () => {
  it("an output pin with no piece is UnconnectedPin without an instance", () => {
    const pins = io(["A"], ["Y"]);
    const { project, host } = single({ pins, wires: [] });
    const withoutOutputPiece = {
      ...host,
      draft: {
        ...host.draft,
        instances: host.draft.instances.filter((item) => item.id !== pins.piece("Y").id),
      },
    };
    expect(errorOf(withChip(project, withoutOutputPiece), host.id)).toEqual({
      type: "UnconnectedPin",
      path: [],
      pin: pins.def("Y").id,
      bit: 0,
    });
  });

  it("a custom chip whose saved version lacks an output piece is UnconnectedPin", () => {
    const { project, host, not, instance } = notHost();
    const saved = {
      ...not.chip.draft,
      instances: not.chip.draft.instances.filter((item) => item.id !== not.pieceY.id),
      wires: not.chip.draft.wires.slice(0, 2),
    };
    const error = errorOf(withChip(project, { ...not.chip, saved }), host.id);
    expect(error).toEqual({
      type: "UnconnectedPin",
      path: [],
      instanceId: instance.id,
      pin: not.pinOut.id,
      bit: 0,
    });
  });
});

const walkOf = (project: Project): Walk => ({
  project,
  nands: [],
  nandIndex: new Map(),
  frames: new Map(),
  checked: new Map(),
});

const outputFrom = (source: ChipInstance) => {
  const pins = io([], ["Y"]);
  const { project, host } = single({ pins, parts: [source], wires: [] });
  const wires = [wire(end(source), end(pins.piece("Y")))];
  const top: Frame = { path: [], circuit: { ...host.draft, wires } };
  return { project, top, source };
};

describe("resolving a walk that disagrees with the circuit", () => {
  it("a NAND the walk never numbered is UnconnectedPin", () => {
    const { project, top, source } = outputFrom(nandPart());
    expect(build(walkOf(project), top)).toEqual({
      ok: false,
      error: { type: "UnconnectedPin", path: [], instanceId: source.id, pin: 0, bit: 0 },
    });
  });

  it("a wire from a missing instance is UnconnectedPin", () => {
    const { project, top } = outputFrom(nandPart());
    const orphan: Frame = {
      ...top,
      circuit: {
        ...top.circuit,
        instances: top.circuit.instances.filter((item) => item.kind.type === "pin"),
      },
    };
    const result = build(walkOf(project), orphan);
    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.type).toBe("UnconnectedPin");
  });

  it("an instance of an unknown kind is rejected by assertNever", () => {
    /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Deliberately violates the exhaustive union to hit assertNever */
    const kind = JSON.parse('{"type":"Bogus"}') as never;
    const { project, top } = outputFrom(piece(kind));
    expect(() => build(walkOf(project), top)).toThrow("Unexpected value");
  });

  it("an input pin the layout does not list is UnconnectedPin", () => {
    const pins = io(["A"], ["Y"]);
    const through = wire(end(pins.piece("A")), end(pins.piece("Y")));
    const { project, host } = single({ pins, wires: [through] });
    const outputs = host.draft.pins.filter((pin) => pin.direction === "output");
    const top: Frame = { path: [], circuit: { ...host.draft, pins: outputs } };
    const result = build(walkOf(project), top);
    expect(result.ok ? undefined : result.error.type).toBe("UnconnectedPin");
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

describe("resolving a circuit with two drivers", () => {
  it("two wires into one sink bit are MultipleDrivers", () => {
    const { project, top } = outputFrom(piece({ type: "clock" }));
    const rivals = top.circuit.wires.map((item) => ({ ...item, id: newWireId() }));
    const doubled: Frame = {
      ...top,
      circuit: { ...top.circuit, wires: [...top.circuit.wires, ...rivals] },
    };
    expect(build(walkOf(project), doubled)).toEqual({
      ok: false,
      error: {
        type: "MultipleDrivers",
        path: [],
        instanceId: top.circuit.wires[0]?.to.instanceId,
      },
    });
  });
});
