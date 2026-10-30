/* oxlint-disable typescript/prefer-readonly-parameter-types -- test fixtures carry branded ids (mutable object types); none is mutated */
import { describe, expect, test } from "vitest";

import { newChip, piece, pinDef, pinPiece, projectWith, wire } from "./builders";
import { createDemoProject } from "./demo";
import type { Circuit, PinRef, Wire } from "./model";
import { checkConnection, findInvalidWire } from "./wiring";

type Ids = Record<
  "inA" | "inB" | "inD" | "inE" | "outY" | "outQ" | "nand" | "split" | "merge" | "clock" | "custom",
  PinRef["instanceId"]
>;

const pinDefs = () => ({
  inA: pinDef("A", "input"),
  inB: pinDef("B", "input"),
  inD: pinDef("D", "input", 4),
  inE: pinDef("E", "input", 8),
  outY: pinDef("Y", "output"),
  outQ: pinDef("Q", "output", 4),
});

const customChip = () => {
  const inner = pinDef("a", "input");
  const saved = { pins: [inner], instances: [pinPiece(inner)], wires: [] };
  return { inner, chip: newChip("NOT", saved, { saved: true }) };
};

const scenario = (wires: (ids: Ids) => Wire[] = () => []) => {
  const defs = pinDefs();
  const { inner, chip } = customChip();
  const named = {
    inA: pinPiece(defs.inA),
    inB: pinPiece(defs.inB),
    inD: pinPiece(defs.inD),
    inE: pinPiece(defs.inE),
    outY: pinPiece(defs.outY),
    outQ: pinPiece(defs.outQ),
    nand: piece({ type: "nand" }),
    split: piece({ type: "split", width: 4 }),
    merge: piece({ type: "merge", width: 8 }),
    clock: piece({ type: "clock" }),
    custom: piece({ type: "custom", chipId: chip.id }),
  };
  const ids: Ids = {
    inA: named.inA.id,
    inB: named.inB.id,
    inD: named.inD.id,
    inE: named.inE.id,
    outY: named.outY.id,
    outQ: named.outQ.id,
    nand: named.nand.id,
    split: named.split.id,
    merge: named.merge.id,
    clock: named.clock.id,
    custom: named.custom.id,
  };
  const circuit: Circuit = {
    pins: Object.values(defs),
    instances: Object.values(named),
    wires: wires(ids),
  };
  return {
    project: projectWith("p", [newChip("Main", circuit), chip]),
    circuit,
    ids,
    innerPin: inner.id,
  };
};

const at = (instanceId: PinRef["instanceId"], pin: PinRef["pin"], bit?: number): PinRef =>
  bit === undefined ? { instanceId, pin } : { instanceId, pin, bit };

describe("checkConnection", () => {
  test("orders ends source -> sink and derives the width", () => {
    const { project, circuit, ids } = scenario();
    expect(checkConnection(project, circuit, at(ids.nand, 0), at(ids.inA, 0))).toEqual({
      ok: true,
      value: { from: at(ids.inA, 0), to: at(ids.nand, 0), bitWidth: 1 },
    });
  });

  test("bus to bus needs equal width", () => {
    const { project, circuit, ids } = scenario();
    const good = checkConnection(project, circuit, at(ids.inD, 0), at(ids.outQ, 0));
    expect(good.ok && good.value.bitWidth).toBe(4);
    expect(checkConnection(project, circuit, at(ids.inE, 0), at(ids.outQ, 0))).toEqual({
      ok: false,
      error: { type: "WidthMismatch", from: 8, to: 4 },
    });
  });
});

describe("checkConnection bit taps", () => {
  test("a tap reaches one bit of a bus from a 1-bit pin", () => {
    const { project, circuit, ids } = scenario();
    const result = checkConnection(project, circuit, at(ids.inD, 0, 2), at(ids.nand, 0));
    expect(result.ok && result.value.bitWidth).toBe(1);
    expect(result.ok && result.value.from.bit).toBe(2);
  });

  test("a tap on a 1-bit pin is BitOutOfRange", () => {
    const { project, circuit, ids } = scenario();
    expect(checkConnection(project, circuit, at(ids.inA, 0, 0), at(ids.nand, 0))).toEqual({
      ok: false,
      error: { type: "BitOutOfRange", bit: 0, width: 1 },
    });
  });

  test("a tap past the width is BitOutOfRange", () => {
    const { project, circuit, ids } = scenario();
    expect(checkConnection(project, circuit, at(ids.inD, 0, 4), at(ids.nand, 0))).toEqual({
      ok: false,
      error: { type: "BitOutOfRange", bit: 4, width: 4 },
    });
  });

  test("a tap on the second end is checked too", () => {
    const { project, circuit, ids } = scenario();
    const result = checkConnection(project, circuit, at(ids.inA, 0), at(ids.outQ, 0, 4));
    expect(result).toEqual({ ok: false, error: { type: "BitOutOfRange", bit: 4, width: 4 } });
  });

  test("a tap cannot meet a whole bus", () => {
    const { project, circuit, ids } = scenario();
    expect(checkConnection(project, circuit, at(ids.inD, 0, 1), at(ids.outQ, 0))).toEqual({
      ok: false,
      error: { type: "WidthMismatch", from: 1, to: 4 },
    });
  });

  test("tap to tap is a 1-bit wire", () => {
    const { project, circuit, ids } = scenario();
    const result = checkConnection(project, circuit, at(ids.inD, 0, 0), at(ids.outQ, 0, 3));
    expect(result.ok && result.value.bitWidth).toBe(1);
  });
});

describe("checkConnection roles and endpoints", () => {
  test("two outputs cannot be joined", () => {
    const { project, circuit, ids } = scenario();
    expect(checkConnection(project, circuit, at(ids.nand, 2), at(ids.inA, 0))).toEqual({
      ok: false,
      error: { type: "OutputToOutput" },
    });
  });

  test("two inputs cannot be joined", () => {
    const { project, circuit, ids } = scenario();
    expect(checkConnection(project, circuit, at(ids.nand, 0), at(ids.outY, 0))).toEqual({
      ok: false,
      error: { type: "InputToInput" },
    });
  });

  test("unknown instance or pin is InvalidEndpoint", () => {
    const { project, circuit, ids } = scenario();
    const { ids: other } = scenario();
    expect(checkConnection(project, circuit, at(other.nand, 0), at(ids.inA, 0))).toEqual({
      ok: false,
      error: { type: "InvalidEndpoint", instanceId: other.nand, pin: 0 },
    });
    expect(checkConnection(project, circuit, at(ids.inA, 0), at(ids.nand, 9))).toEqual({
      ok: false,
      error: { type: "InvalidEndpoint", instanceId: ids.nand, pin: 9 },
    });
  });

  test("custom pins connect by PinId", () => {
    const { project, circuit, ids, innerPin } = scenario();
    const result = checkConnection(project, circuit, at(ids.inA, 0), at(ids.custom, innerPin));
    expect(result.ok && result.value.to).toEqual(at(ids.custom, innerPin));
  });

  test("an output may feed several inputs", () => {
    const { project, circuit, ids } = scenario((own) => [wire(at(own.inA, 0), at(own.nand, 0))]);
    expect(checkConnection(project, circuit, at(ids.inA, 0), at(ids.nand, 1)).ok).toBe(true);
  });
});

describe("single driver per input bit", () => {
  test("a second wire to a 1-bit input is InputAlreadyDriven", () => {
    const { project, circuit, ids } = scenario((own) => [wire(at(own.inA, 0), at(own.nand, 0))]);
    expect(checkConnection(project, circuit, at(ids.inB, 0), at(ids.nand, 0))).toEqual({
      ok: false,
      error: { type: "InputAlreadyDriven", instanceId: ids.nand },
    });
  });

  test("a tap onto a bus already driven whole is rejected", () => {
    const { project, circuit, ids } = scenario((own) => [wire(at(own.inD, 0), at(own.outQ, 0), 4)]);
    expect(checkConnection(project, circuit, at(ids.inA, 0), at(ids.outQ, 0, 1))).toEqual({
      ok: false,
      error: { type: "InputAlreadyDriven", instanceId: ids.outQ },
    });
  });

  test("taps on different bits coexist; a whole wire over a tap does not", () => {
    const { project, circuit, ids } = scenario((own) => [wire(at(own.inA, 0), at(own.outQ, 0, 1))]);
    expect(checkConnection(project, circuit, at(ids.inB, 0), at(ids.outQ, 0, 2)).ok).toBe(true);
    expect(checkConnection(project, circuit, at(ids.inD, 0), at(ids.outQ, 0))).toEqual({
      ok: false,
      error: { type: "InputAlreadyDriven", instanceId: ids.outQ },
    });
    expect(checkConnection(project, circuit, at(ids.inB, 0), at(ids.outQ, 0, 1)).ok).toBe(false);
  });

  test("ignoreWireId skips the wire being re-checked", () => {
    const { project, circuit, ids } = scenario((own) => [wire(at(own.inA, 0), at(own.nand, 0))]);
    const [existing] = circuit.wires;
    expect(
      checkConnection(project, circuit, at(ids.inB, 0), at(ids.nand, 0), existing?.id).ok,
    ).toBe(true);
  });
});

describe("findInvalidWire", () => {
  test("none in the demo", () => {
    const project = createDemoProject("demo");
    const [chip] = project.chips;
    expect(chip && findInvalidWire(project, chip.draft)).toBeUndefined();
  });

  test("catches backwards, wrong-width and dangling wires", () => {
    const backwards = scenario((own) => [wire(at(own.nand, 0), at(own.inA, 0))]);
    expect(findInvalidWire(backwards.project, backwards.circuit)).toBe(backwards.circuit.wires[0]);
    const wrongWidth = scenario((own) => [wire(at(own.inD, 0), at(own.outQ, 0), 1)]);
    expect(findInvalidWire(wrongWidth.project, wrongWidth.circuit)).toBe(
      wrongWidth.circuit.wires[0],
    );
    const wrongTap = scenario((own) => [wire(at(own.inD, 0), at(own.outQ, 0, 1), 1)]);
    expect(findInvalidWire(wrongTap.project, wrongTap.circuit)).toBe(wrongTap.circuit.wires[0]);
    const swappedTap = scenario((own) => [wire(at(own.nand, 0), at(own.inD, 0, 1), 1)]);
    expect(findInvalidWire(swappedTap.project, swappedTap.circuit)).toBe(
      swappedTap.circuit.wires[0],
    );
    const dangling = scenario((own) => [wire(at(own.inA, 0), at(own.nand, 7))]);
    expect(findInvalidWire(dangling.project, dangling.circuit)).toBe(dangling.circuit.wires[0]);
  });
});
