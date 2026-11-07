import { describe, expect, it } from "vitest";

import type { WireTarget } from "~/features/circuit-editor";
import type { PinRef } from "~/features/projects";
import { newInstanceId } from "~/shared/ids";

import { bitAsk, matching, refsOf, targetKey } from "./wire-to-plan";

const ref = (pin: number): PinRef => ({ instanceId: newInstanceId(), pin });

const target = (label: string, width: number, bits: number): WireTarget => ({
  ref: ref(0),
  label,
  width,
  bits,
});

describe("bitAsk", () => {
  it("asks for no bit when both ends are one bit", () => {
    expect(bitAsk(1, target("a of NAND gate 1", 1, 1))).toEqual({ from: 1, target: 1 });
  });

  it("asks for a bit on a bus target when the source is one bit", () => {
    expect(bitAsk(1, target("d of Bus", 4, 4))).toEqual({ from: 1, target: 4 });
  });

  it("asks for no bit when two buses have the same width", () => {
    expect(bitAsk(4, target("d of Bus", 4, 1))).toEqual({ from: 1, target: 1 });
  });

  it("asks for a bit on the source when it is a bus and the target is one bit", () => {
    expect(bitAsk(4, target("a of NAND gate 1", 1, 1))).toEqual({ from: 4, target: 1 });
  });
});

describe("refsOf", () => {
  const from = ref(1);

  it("leaves the bit out for one-bit ends", () => {
    const one = target("a of NAND gate 1", 1, 1);
    expect(refsOf({ ref: from, width: 1 }, one, { from: 0, target: 0 })).toEqual({
      from,
      to: one.ref,
    });
  });

  it("puts the chosen bit on a bus target", () => {
    const bus = target("d of Bus", 4, 4);
    expect(refsOf({ ref: from, width: 1 }, bus, { from: 0, target: 2 }).to).toEqual({
      ...bus.ref,
      bit: 2,
    });
  });

  it("puts the chosen bit on a bus source and not on a one-bit target", () => {
    const one = target("a of NAND gate 1", 1, 1);
    const refs = refsOf({ ref: from, width: 4 }, one, { from: 3, target: 0 });
    expect(refs.from).toEqual({ ...from, bit: 3 });
    expect(refs.to).toEqual(one.ref);
  });

  it("puts no bit on a bus to bus wire of the same width", () => {
    const refs = refsOf({ ref: from, width: 4 }, target("d of Bus", 4, 1), { from: 3, target: 2 });
    expect(refs.from).toEqual(from);
    expect(refs.to).not.toHaveProperty("bit");
  });
});

describe("matching", () => {
  const list = [target("a of NAND gate 1", 1, 1), target("OUT of Output OUT", 1, 1)];

  it("keeps every target for an empty query", () => {
    expect(matching(list, "  ")).toHaveLength(2);
  });

  it("narrows by name without regard to case", () => {
    expect(matching(list, "nand").map(({ label }) => label)).toEqual(["a of NAND gate 1"]);
  });

  it("gives each target its own key", () => {
    expect(new Set(list.map((item) => targetKey(item))).size).toBe(2);
  });
});
