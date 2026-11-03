import { assert, describe, expect, it } from "vitest";

import { EMPTY_CIRCUIT, newChip, pinDef, pinPiece, projectWith, wire } from "~/features/projects";
import type { ChipInstance, PinDef, PinRef, Wire } from "~/features/projects";

import { planBulkWires } from "./bulk-wiring";
import type { Scene } from "./geometry";

type Direction = "input" | "output";
type Width = 1 | 4 | 8;

/** Every pin definition made by `pinOf`, so a scene can list the ones its pieces use. */
const defs = new Map<string, PinDef>();

/** A pin piece: a circuit input drives (a source), a circuit output takes a wire (a sink). */
const pinOf = (direction: Direction, width: Width = 1): ChipInstance => {
  const def = pinDef("p", direction, width);
  defs.set(def.id, def);
  return pinPiece(def);
};

const refOf = (instance: ChipInstance, bit?: number): PinRef =>
  bit === undefined
    ? { instanceId: instance.id, pin: 0 }
    : { instanceId: instance.id, pin: 0, bit };

const refAt = (list: readonly ChipInstance[], index: number, bit?: number): PinRef => {
  const item = list[index];
  assert(item !== undefined);
  return refOf(item, bit);
};

const idAt = (list: readonly ChipInstance[], index: number) => refAt(list, index).instanceId;

const sceneOf = (instances: readonly ChipInstance[], wires: readonly Wire[] = []): Scene => {
  const pins = instances.flatMap((instance) => {
    const def = instance.kind.type === "pin" ? defs.get(instance.kind.pinId) : undefined;
    return def === undefined ? [] : [def];
  });
  const circuit = { ...EMPTY_CIRCUIT, pins, instances, wires };
  return { project: projectWith("bulk", [newChip("c", circuit)]), circuit };
};

const many = (count: number, direction: Direction, width: Width = 1) =>
  Array.from({ length: count }, () => pinOf(direction, width));

const plan = (scene: Scene, source: ChipInstance, pins: readonly ChipInstance[]) =>
  planBulkWires(scene, { source: refOf(source), pins: pins.map((pin) => refOf(pin)) });

const wiresOf = (result: ReturnType<typeof plan>) => (result.ok ? result.value.wires : []);

describe("planBulkWires: fan-out", () => {
  it("wires a 1-bit output to 16 inputs", () => {
    const source = pinOf("input");
    const sinks = many(16, "output");
    const result = plan(sceneOf([source, ...sinks]), source, sinks);
    expect(result.ok && result.value.shape).toEqual({ type: "fanOut" });
    expect(wiresOf(result).map((item) => item.to.instanceId)).toEqual(sinks.map((item) => item.id));
    expect(wiresOf(result).every((item) => item.from.instanceId === source.id)).toBe(true);
  });

  it("wires a 4-bit output to three 4-bit inputs as whole buses", () => {
    const source = pinOf("input", 4);
    const sinks = many(3, "output", 4);
    const found = wiresOf(plan(sceneOf([source, ...sinks]), source, sinks));
    expect(found).toHaveLength(3);
    expect(found.every((item) => item.from.bit === undefined && item.to.bit === undefined)).toBe(
      true,
    );
  });

  it("plans nothing for no pins", () => {
    const source = pinOf("input");
    const result = plan(sceneOf([source]), source, []);
    expect(result.ok && result.value.wires).toEqual([]);
  });
});

describe("planBulkWires: bit by bit", () => {
  it("gives selected pin k bit k of the source", () => {
    const source = pinOf("input", 4);
    const sinks = many(4, "output");
    const result = plan(sceneOf([source, ...sinks]), source, sinks);
    expect(wiresOf(result).map((item) => item.from.bit)).toEqual([0, 1, 2, 3]);
    expect(result.ok && result.value.shape).toEqual({ type: "bits", first: 0, last: 3 });
  });

  it("follows selection order", () => {
    const source = pinOf("input", 4);
    const sinks = many(4, "output");
    const result = plan(sceneOf([source, ...sinks]), source, sinks.toReversed());
    expect(wiresOf(result).map((item) => [item.to.instanceId, item.from.bit])).toEqual(
      sinks.toReversed().map((item, index) => [item.id, index]),
    );
  });

  it("wires the low bits when fewer pins are selected", () => {
    const source = pinOf("input", 4);
    const sinks = many(2, "output");
    const result = plan(sceneOf([source, ...sinks]), source, sinks);
    expect(wiresOf(result).map((item) => item.from.bit)).toEqual([0, 1]);
    expect(result.ok && result.value.shape).toEqual({ type: "bits", first: 0, last: 1 });
  });

  it("refuses five pins for four bits at the fifth", () => {
    const source = pinOf("input", 4);
    const sinks = many(5, "output");
    const result = plan(sceneOf([source, ...sinks]), source, sinks);
    expect(result).toEqual({
      ok: false,
      error: {
        reason: { type: "TooManyPins", pins: 5, bits: 4 },
        at: refAt(sinks, 4),
      },
    });
  });
});

describe("planBulkWires: reverse", () => {
  it("wires four 1-bit outputs into the bits of a 4-bit input", () => {
    const source = pinOf("output", 4);
    const ins = many(4, "input");
    const found = wiresOf(plan(sceneOf([source, ...ins]), source, ins));
    expect(found.map((item) => [item.from.instanceId, item.to.bit])).toEqual(
      ins.map((item, index) => [item.id, index]),
    );
    expect(found.every((item) => item.to.instanceId === source.id)).toBe(true);
  });

  it("allows one same-width output", () => {
    const source = pinOf("output");
    const input = pinOf("input");
    const result = plan(sceneOf([source, input]), source, [input]);
    expect(wiresOf(result)).toHaveLength(1);
  });

  it("refuses two same-width outputs at the second", () => {
    const source = pinOf("output");
    const ins = many(2, "input");
    expect(plan(sceneOf([source, ...ins]), source, ins)).toEqual({
      ok: false,
      error: { reason: { type: "InputTakesOneWire" }, at: refAt(ins, 1) },
    });
  });

  it("refuses when bit 2 of the source is already driven, at the third pin", () => {
    const source = pinOf("output", 4);
    const ins = many(4, "input");
    const other = pinOf("input");
    const driven = wire(refOf(other), refOf(source, 2));
    const result = plan(sceneOf([source, ...ins, other], [driven]), source, ins);
    expect(!result.ok && result.error.reason.type).toBe("InputAlreadyDriven");
    expect(!result.ok && result.error.at).toEqual(refAt(ins, 2));
  });
});

describe("planBulkWires: refused", () => {
  it("mixed widths are refused at the first that differs", () => {
    const source = pinOf("input");
    const sinks = [pinOf("output"), pinOf("output", 4), pinOf("output")];
    const result = plan(sceneOf([source, ...sinks]), source, sinks);
    expect(!result.ok && result.error).toEqual({
      reason: { type: "MixedPins" },
      at: refAt(sinks, 1),
    });
  });

  it("mixed directions are refused", () => {
    const source = pinOf("input");
    const pins = [pinOf("output"), pinOf("input")];
    const result = plan(sceneOf([source, ...pins]), source, pins);
    expect(!result.ok && result.error).toEqual({
      reason: { type: "MixedPins" },
      at: refAt(pins, 1),
    });
  });
});

describe("planBulkWires: refused by the case", () => {
  it("the source's own direction is refused at the first pin", () => {
    const source = pinOf("input");
    const pins = many(2, "input");
    const result = plan(sceneOf([source, ...pins]), source, pins);
    expect(!result.ok && result.error).toEqual({
      reason: { type: "SameDirection" },
      at: refAt(pins, 0),
    });
  });

  it("the source in the list is refused at the source", () => {
    const source = pinOf("input");
    const sink = pinOf("output");
    const result = planBulkWires(sceneOf([source, sink]), {
      source: refOf(source),
      pins: [refOf(sink), refOf(source)],
    });
    expect(!result.ok && result.error).toEqual({
      reason: { type: "SourceSelected" },
      at: refOf(source),
    });
  });

  it("different wide widths fall to the width check at the first pin", () => {
    const source = pinOf("input", 4);
    const sinks = many(2, "output", 8);
    const result = plan(sceneOf([source, ...sinks]), source, sinks);
    expect(!result.ok && result.error.reason.type).toBe("WidthMismatch");
  });

  it("a pin that is not there is an invalid endpoint", () => {
    const source = pinOf("input");
    const sink = pinOf("output");
    const result = planBulkWires(sceneOf([source]), { source: refOf(source), pins: [refOf(sink)] });
    expect(!result.ok && result.error.reason.type).toBe("InvalidEndpoint");
  });
});

describe("planBulkWires: all or nothing", () => {
  it("refuses at the 7th of 16 inputs that already has a wire", () => {
    const source = pinOf("input");
    const other = pinOf("input");
    const sinks = many(16, "output");
    const driven = wire(refOf(other), refAt(sinks, 6));
    const result = plan(sceneOf([source, other, ...sinks], [driven]), source, sinks);
    expect(result).toEqual({
      ok: false,
      error: {
        reason: { type: "InputAlreadyDriven", instanceId: idAt(sinks, 6) },
        at: refAt(sinks, 6),
      },
    });
  });

  it("never changes the scene", () => {
    const source = pinOf("input", 4);
    const sinks = many(4, "output");
    const scene = sceneOf([source, ...sinks]);
    const before = structuredClone(scene);
    plan(scene, source, sinks);
    plan(scene, source, many(5, "output"));
    expect(scene).toEqual(before);
  });
});
