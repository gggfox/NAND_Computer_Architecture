/* oxlint-disable typescript/prefer-readonly-parameter-types -- test fixtures carry branded ids (mutable object types); none is mutated */
import { describe, expect, test } from "vitest";

import { newPinId } from "~/shared/ids";

import { newChip, piece, pinDef, pinPiece, projectWith } from "./builders";
import type { ChipInstance, Circuit, PinKey } from "./model";
import { endpointInfo, pinKeys } from "./pins";

const chips = () => {
  const notIn = pinDef("a", "input");
  const notOut = pinDef("y", "output");
  const saved = { pins: [notIn, notOut], instances: [], wires: [] };
  const draft = { pins: [notIn], instances: [], wires: [] };
  return {
    notIn,
    notOut,
    not: newChip("NOT", saved, { saved: true }),
    draftOnly: newChip("Draft", draft),
  };
};

const scenario = () => {
  const { notIn, notOut, not, draftOnly } = chips();
  const inD = pinDef("D", "input", 4);
  const outQ = pinDef("Q", "output", 4);
  const pieces = {
    inD: pinPiece(inD),
    outQ: pinPiece(outQ),
    nand: piece({ type: "nand" }),
    split: piece({ type: "split", width: 4 }),
    merge: piece({ type: "merge", width: 8 }),
    clock: piece({ type: "clock" }),
    saved: piece({ type: "custom", chipId: not.id }),
    draftOnly: piece({ type: "custom", chipId: draftOnly.id }),
    dangling: piece({ type: "pin", pinId: newPinId() }),
  };
  const circuit: Circuit = { pins: [inD, outQ], instances: Object.values(pieces), wires: [] };
  const project = projectWith("p", [newChip("Main", circuit), not, draftOnly]);
  const info = (instance: ChipInstance, pin: PinKey) =>
    endpointInfo(project, circuit, instance, pin);
  const keys = (instance: ChipInstance) => pinKeys(project, instance);
  return { pieces, info, keys, notIn, notOut };
};

describe("endpointInfo built-ins", () => {
  test("NAND: 0 and 1 are 1-bit sinks, 2 a 1-bit source, 3 nothing", () => {
    const { pieces, info } = scenario();
    expect(info(pieces.nand, 0)).toEqual({ role: "sink", width: 1 });
    expect(info(pieces.nand, 1)).toEqual({ role: "sink", width: 1 });
    expect(info(pieces.nand, 2)).toEqual({ role: "source", width: 1 });
    expect(info(pieces.nand, 3)).toBeUndefined();
  });

  test("pin pieces: an input drives its width, an output sinks it", () => {
    const { pieces, info } = scenario();
    expect(info(pieces.inD, 0)).toEqual({ role: "source", width: 4 });
    expect(info(pieces.outQ, 0)).toEqual({ role: "sink", width: 4 });
    expect(info(pieces.inD, 1)).toBeUndefined();
  });

  test("split 4: 0 is a 4-bit sink, 1..4 are 1-bit sources, 5 nothing", () => {
    const { pieces, info } = scenario();
    expect(info(pieces.split, 0)).toEqual({ role: "sink", width: 4 });
    expect(info(pieces.split, 1)).toEqual({ role: "source", width: 1 });
    expect(info(pieces.split, 4)).toEqual({ role: "source", width: 1 });
    expect(info(pieces.split, 5)).toBeUndefined();
  });

  test("merge 8: 0..7 are 1-bit sinks, 8 is the 8-bit source", () => {
    const { pieces, info } = scenario();
    expect(info(pieces.merge, 0)).toEqual({ role: "sink", width: 1 });
    expect(info(pieces.merge, 7)).toEqual({ role: "sink", width: 1 });
    expect(info(pieces.merge, 8)).toEqual({ role: "source", width: 8 });
    expect(info(pieces.merge, 9)).toBeUndefined();
  });

  test("clock: 0 is a 1-bit source", () => {
    const { pieces, info } = scenario();
    expect(info(pieces.clock, 0)).toEqual({ role: "source", width: 1 });
    expect(info(pieces.clock, 1)).toBeUndefined();
  });

  test("built-in parts reject PinId keys", () => {
    const { pieces, info, notIn } = scenario();
    expect(info(pieces.nand, notIn.id)).toBeUndefined();
  });
});

describe("endpointInfo pin numbers", () => {
  test("negative and fractional pin numbers resolve to nothing", () => {
    const { pieces, info } = scenario();
    for (const part of [pieces.nand, pieces.split, pieces.merge, pieces.clock, pieces.inD]) {
      expect(info(part, -1)).toBeUndefined();
      expect(info(part, 0.5)).toBeUndefined();
    }
  });
});

describe("endpointInfo custom chips", () => {
  test("custom pins are PinIds of the saved version", () => {
    const { pieces, info, notIn, notOut } = scenario();
    expect(info(pieces.saved, notIn.id)).toEqual({ role: "sink", width: 1 });
    expect(info(pieces.saved, notOut.id)).toEqual({ role: "source", width: 1 });
    expect(info(pieces.saved, 0)).toBeUndefined();
    expect(info(pieces.saved, newPinId())).toBeUndefined();
  });

  test("a draft-only chip, a missing chip and a dangling pin piece have no pins", () => {
    const { pieces, info, notIn } = scenario();
    expect(info(pieces.draftOnly, notIn.id)).toBeUndefined();
    expect(info(pieces.dangling, 0)).toBeUndefined();
    const missing = piece({ type: "custom", chipId: newChip("gone").id });
    expect(info(missing, notIn.id)).toBeUndefined();
  });
});

describe("pinKeys", () => {
  test("lists every pin endpointInfo resolves, in drawing order", () => {
    const { pieces, keys, info, notIn, notOut } = scenario();
    expect(keys(pieces.nand)).toEqual([0, 1, 2]);
    expect(keys(pieces.clock)).toEqual([0]);
    expect(keys(pieces.inD)).toEqual([0]);
    expect(keys(pieces.split)).toEqual([0, 1, 2, 3, 4]);
    expect(keys(pieces.merge)).toHaveLength(9);
    expect(keys(pieces.saved)).toEqual([notIn.id, notOut.id]);
    for (const part of [pieces.nand, pieces.split, pieces.merge, pieces.saved]) {
      expect(keys(part).every((pin) => info(part, pin) !== undefined)).toBe(true);
    }
  });

  test("a draft-only or missing chip has no pins", () => {
    const { pieces, keys } = scenario();
    expect(keys(pieces.draftOnly)).toEqual([]);
    const missing = piece({ type: "custom", chipId: newChip("gone").id });
    expect(keys(missing)).toEqual([]);
  });
});
