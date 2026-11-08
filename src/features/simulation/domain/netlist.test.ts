import { describe, expect, test } from "vitest";

import { compileNetlist } from "./netlist";
import type { NetlistSource } from "./netlist";

const singleNand = (a: NetlistSource["outputs"][number]): NetlistSource => ({
  inputCount: 2,
  nands: [{ a, b: { kind: "input", index: 1 } }],
  outputs: [{ kind: "nand", index: 0 }],
});

describe("compileNetlist", () => {
  test("lays signals out as [inputs..., clock, nand outputs...]", () => {
    const result = compileNetlist(singleNand({ kind: "input", index: 0 }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.inputCount).toBe(2);
      expect(result.value.nandCount).toBe(1);
      expect([...result.value.nandA]).toEqual([0]);
      expect([...result.value.nandB]).toEqual([1]);
      expect([...result.value.outputs]).toEqual([3]);
    }
  });
  test("a nand ref past the last nand is SignalOutOfRange", () => {
    const ref = { kind: "nand", index: 5 } as const;
    expect(compileNetlist(singleNand(ref))).toEqual({
      ok: false,
      error: { type: "SignalOutOfRange", ref },
    });
  });
  test.each([
    { kind: "input", index: 2 },
    { kind: "input", index: -1 },
    { kind: "input", index: 0.5 },
  ] as const)("input ref %o is SignalOutOfRange", (ref) => {
    expect(compileNetlist(singleNand(ref))).toEqual({
      ok: false,
      error: { type: "SignalOutOfRange", ref },
    });
  });
  test("an out-of-range b input is SignalOutOfRange", () => {
    const ref = { kind: "nand", index: 3 } as const;
    const source: NetlistSource = {
      inputCount: 1,
      nands: [{ a: { kind: "input", index: 0 }, b: ref }],
      outputs: [],
    };
    expect(compileNetlist(source)).toEqual({
      ok: false,
      error: { type: "SignalOutOfRange", ref },
    });
  });
  test("an out-of-range output is SignalOutOfRange", () => {
    const ref = { kind: "nand", index: 1 } as const;
    const source: NetlistSource = { ...singleNand({ kind: "input", index: 0 }), outputs: [ref] };
    expect(compileNetlist(source)).toEqual({
      ok: false,
      error: { type: "SignalOutOfRange", ref },
    });
  });
});

describe("compileNetlist clock", () => {
  test("the clock is the signal right after the inputs", () => {
    const result = compileNetlist({
      inputCount: 2,
      nands: [{ a: { kind: "clock" }, b: { kind: "nand", index: 0 } }],
      outputs: [{ kind: "nand", index: 0 }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect([...result.value.nandA]).toEqual([2]);
      expect([...result.value.nandB]).toEqual([3]);
      expect([...result.value.outputs]).toEqual([3]);
    }
  });

  test.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "inputCount %s is InvalidInputCount",
    (inputCount) => {
      expect(compileNetlist({ inputCount, nands: [], outputs: [] })).toEqual({
        ok: false,
        error: { type: "InvalidInputCount", inputCount },
      });
    },
  );
});
