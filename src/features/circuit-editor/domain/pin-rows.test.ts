import { describe, expect, it } from "vitest";

import { createDemoProject, EMPTY_CIRCUIT, pinDef, pinPiece } from "~/features/projects";
import type { Circuit } from "~/features/projects";

import { columnPositions } from "./pin-placement";
import {
  bitString,
  maxValueOf,
  newPins,
  PIN_WIDTHS,
  pinRows,
  rowAfter,
  rowNear,
  widthOf,
} from "./pin-rows";
import { applyAction } from "./reducer";

const demo = () => {
  const project = createDemoProject("x");
  const [chip] = project.chips;
  return { project, chipId: chip?.id, circuit: chip?.draft ?? EMPTY_CIRCUIT };
};

const pieceOf = (circuit: Circuit, name: string) => {
  const pin = circuit.pins.find((item) => item.name === name);
  return circuit.instances.find((item) => item.kind.type === "pin" && item.kind.pinId === pin?.id);
};

describe("pinRows", () => {
  it("lists the demo's inputs and outputs in panel order, numbered from 1", () => {
    const { circuit } = demo();
    const rows = pinRows(circuit, new Set());
    expect(rows.inputs.map((row) => [row.name, row.ordinal, row.width])).toEqual([
      ["A", 1, 1],
      ["B", 2, 1],
    ]);
    expect(rows.outputs.map((row) => [row.name, row.ordinal])).toEqual([["OUT", 1]]);
    expect(rows.inputs[0]?.instanceId).toBe(pieceOf(circuit, "A")?.id);
    expect(rows.inputs[0]?.pinId).toBe(circuit.pins[0]?.id);
  });

  it("marks the row of a selected piece", () => {
    const { circuit } = demo();
    const pieceB = pieceOf(circuit, "B");
    const rows = pinRows(circuit, new Set(pieceB === undefined ? [] : [pieceB.id]));
    expect(rows.inputs.map((row) => row.selected)).toEqual([false, true]);
    expect(rows.outputs.map((row) => row.selected)).toEqual([false]);
  });

  it("follows a reorder", () => {
    const { project, chipId, circuit } = demo();
    const pinB = circuit.pins.find((pin) => pin.name === "B");
    expect(chipId && pinB).toBeDefined();
    if (chipId === undefined || pinB === undefined) {
      return;
    }
    const moved = applyAction(project, { type: "reorderPin", chipId, pinId: pinB.id, toIndex: 0 });
    expect(moved.ok).toBe(true);
    const draft = moved.ok ? moved.value.chips[0]?.draft : undefined;
    const rows = pinRows(draft ?? EMPTY_CIRCUIT, new Set());
    expect(rows.inputs.map((row) => row.name)).toEqual(["B", "A"]);
  });

  it("is empty for a circuit without pins", () => {
    expect(pinRows(EMPTY_CIRCUIT, new Set())).toEqual({ inputs: [], outputs: [] });
  });

  it("leaves out a pin that has no piece on the canvas", () => {
    const placed = pinDef("A", "input");
    const loose = pinDef("B", "input");
    const circuit: Circuit = { pins: [placed, loose], instances: [pinPiece(placed)], wires: [] };
    expect(pinRows(circuit, new Set()).inputs.map((row) => row.name)).toEqual(["A"]);
  });
});

describe("rowAfter", () => {
  it("runs from the last input into the first output, and stops after the last row", () => {
    const { circuit } = demo();
    const rows = pinRows(circuit, new Set());
    const [a, b] = rows.inputs;
    const [out] = rows.outputs;
    expect(a && rowAfter(rows, a.pinId)?.name).toBe("B");
    expect(b && rowAfter(rows, b.pinId)?.name).toBe("OUT");
    expect(out && rowAfter(rows, out.pinId)).toBeUndefined();
  });

  it("finds nothing after a pin that is not listed", () => {
    const rows = pinRows(demo().circuit, new Set());
    expect(rowAfter(rows, pinDef("Z", "input").id)).toBeUndefined();
  });
});

describe("rowNear", () => {
  it("prefers the row after, then the row before", () => {
    const rows = pinRows(demo().circuit, new Set());
    const [a, b] = rows.inputs;
    const [out] = rows.outputs;
    expect(a && rowNear(rows, a.pinId)?.name).toBe("B");
    expect(out && rowNear(rows, out.pinId)?.name).toBe("B");
    expect(b && rowNear(rows, b.pinId)?.name).toBe("OUT");
  });

  it("finds nothing for a lone or unlisted pin", () => {
    const only = pinDef("A", "input");
    const circuit: Circuit = { pins: [only], instances: [pinPiece(only)], wires: [] };
    const rows = pinRows(circuit, new Set());
    expect(rowNear(rows, only.id)).toBeUndefined();
    expect(rowNear(rows, pinDef("Z", "input").id)).toBeUndefined();
  });
});

describe("pin values and widths", () => {
  it("reads a width menu key", () => {
    expect(PIN_WIDTHS.map((width) => widthOf(String(width)))).toEqual([1, 4, 8, 16]);
    expect(widthOf("3")).toBeUndefined();
  });

  it("gives the largest value of each width", () => {
    expect(PIN_WIDTHS.map((width) => maxValueOf(width))).toEqual([1, 15, 255, 65_535]);
  });

  it("writes bits with bit 0 rightmost, padded to the width", () => {
    expect(bitString(5, 4)).toBe("0101");
    expect(bitString(1, 8)).toBe("00000001");
    expect(bitString(0, 1)).toBe("0");
  });
});

describe("newPins", () => {
  it("names and stacks new inputs below the demo's inputs", () => {
    const { project, circuit } = demo();
    const scene = { project, circuit };
    const added = newPins(scene, { direction: "input", count: 3, width: 4 });
    expect(added.map((item) => [item.pin.name, item.pin.width, item.pin.direction])).toEqual([
      ["C", 4, "input"],
      ["D", 4, "input"],
      ["E", 4, "input"],
    ]);
    const widths = added.map(() => 4 as const);
    expect(added.map((item) => item.position)).toEqual(columnPositions(scene, "input", widths));
    expect(new Set(added.map((item) => item.instanceId)).size).toBe(3);
  });

  it("names new outputs OUT1, OUT2", () => {
    const { project, circuit } = demo();
    const added = newPins({ project, circuit }, { direction: "output", count: 2, width: 1 });
    expect(added.map((item) => item.pin.name)).toEqual(["OUT1", "OUT2"]);
  });
});
