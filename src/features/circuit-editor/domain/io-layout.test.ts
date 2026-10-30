import { describe, expect, it } from "vitest";

import { pinDef, pinPiece } from "~/features/projects";
import type { Circuit } from "~/features/projects";

import { ioLayout, packInputs, unpackOutputs } from "./io-layout";

const NIBBLE = 4;
const pinA = pinDef("A", "input");
const pinD = pinDef("D", "input", NIBBLE);
const pinY = pinDef("Y", "output");
const pinQ = pinDef("Q", "output", NIBBLE);
const pins = [pinA, pinD, pinY, pinQ];
const circuit: Circuit = { pins, instances: pins.map((def) => pinPiece(def)), wires: [] };
const layout = ioLayout(circuit);

describe("ioLayout", () => {
  it("slots follow Pins-panel order, bit 0 first", () => {
    expect(layout).toEqual({
      inputs: [
        { pinId: pinA.id, width: 1, offset: 0 },
        { pinId: pinD.id, width: NIBBLE, offset: 1 },
      ],
      outputs: [
        { pinId: pinY.id, width: 1, offset: 0 },
        { pinId: pinQ.id, width: NIBBLE, offset: 1 },
      ],
    });
  });
});

describe("packInputs", () => {
  it("spreads bits; missing pins are 0", () => {
    expect(packInputs(layout, new Map([[pinD.id, 0b1010]]))).toEqual([0, 0, 1, 0, 1]);
  });

  it("ignores bits past the width", () => {
    expect(packInputs(layout, new Map([[pinD.id, 0b1_1111]]))).toEqual([0, 1, 1, 1, 1]);
  });
});

describe("unpackOutputs", () => {
  it("rebuilds values", () => {
    expect(unpackOutputs(layout, [1, 1, 0, 1, 1])).toEqual(
      new Map([
        [pinY.id, 1],
        [pinQ.id, 13],
      ]),
    );
  });

  it("reads missing bits as 0", () => {
    expect(unpackOutputs(layout, [1])).toEqual(
      new Map([
        [pinY.id, 1],
        [pinQ.id, 0],
      ]),
    );
  });
});
