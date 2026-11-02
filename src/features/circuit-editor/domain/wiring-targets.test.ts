import { describe, expect, it } from "vitest";

import {
  EMPTY_CIRCUIT,
  newChip,
  pinDef,
  pinKeys,
  pinPiece,
  projectWith,
  wire,
} from "~/features/projects";
import type { ChipInstance, PinDef, Wire } from "~/features/projects";

import type { Scene } from "./geometry";
import { nandAt, NAND_A, NAND_B, NAND_OUT } from "./routing/routing.fixtures";
import { pinLevelKey } from "./signals";
import { completionFor, legalTargets, usedBits } from "./wiring-targets";

const sceneWith = (
  pins: readonly PinDef[],
  instances: readonly ChipInstance[],
  wires: readonly Wire[] = [],
): Scene => {
  const circuit = { ...EMPTY_CIRCUIT, pins, instances, wires };
  return { project: projectWith("targets", [newChip("c", circuit)]), circuit };
};

const ref = (instance: ChipInstance, pin: number, bit?: number) =>
  bit === undefined ? { instanceId: instance.id, pin } : { instanceId: instance.id, pin, bit };

const bus = (name: string, direction: "input" | "output", width: 4 | 8 = 4) => {
  const def = pinDef(name, direction, width);
  return { def, piece: pinPiece(def) };
};

describe("legalTargets", () => {
  it("a NAND output can reach both inputs of another NAND", () => {
    const first = nandAt(0, 0);
    const second = nandAt(300, 0);
    const scene = sceneWith([], [first, second]);
    const targets = legalTargets(scene, ref(first, NAND_OUT));
    expect(targets.has(pinLevelKey(second.id, NAND_A))).toBe(true);
    expect(targets.has(pinLevelKey(second.id, NAND_B))).toBe(true);
  });

  it("output to output is not legal", () => {
    const first = nandAt(0, 0);
    const second = nandAt(300, 0);
    const targets = legalTargets(sceneWith([], [first, second]), ref(first, NAND_OUT));
    expect(targets.has(pinLevelKey(second.id, NAND_OUT))).toBe(false);
    expect(targets.has(pinLevelKey(first.id, NAND_OUT))).toBe(false);
  });

  it("an already-driven input is not a legal target", () => {
    const first = nandAt(0, 0);
    const second = nandAt(300, 0);
    const third = nandAt(600, 0);
    const driven = wire(ref(first, NAND_OUT), ref(third, NAND_A));
    const targets = legalTargets(
      sceneWith([], [first, second, third], [driven]),
      ref(second, NAND_OUT),
    );
    expect(targets.has(pinLevelKey(third.id, NAND_A))).toBe(false);
    expect(targets.has(pinLevelKey(third.id, NAND_B))).toBe(true);
  });

  it("a pin's own chip is legal for a feedback loop", () => {
    const only = nandAt(0, 0);
    const scene = sceneWith([], [only]);
    expect(legalTargets(scene, ref(only, NAND_OUT)).has(pinLevelKey(only.id, NAND_A))).toBe(true);
    expect(completionFor(scene, ref(only, NAND_OUT), ref(only, NAND_A))).toEqual({
      type: "connect",
      from: ref(only, NAND_OUT),
      to: ref(only, NAND_A),
    });
  });
});

describe("completionFor says why a pin is illegal", () => {
  it("output to output", () => {
    const first = nandAt(0, 0);
    const second = nandAt(300, 0);
    const scene = sceneWith([], [first, second]);
    expect(completionFor(scene, ref(first, NAND_OUT), ref(second, NAND_OUT))).toEqual({
      type: "illegal",
      reason: { type: "OutputToOutput" },
    });
  });

  it("an input already driven", () => {
    const first = nandAt(0, 0);
    const second = nandAt(300, 0);
    const third = nandAt(600, 0);
    const driven = wire(ref(first, NAND_OUT), ref(third, NAND_A));
    const scene = sceneWith([], [first, second, third], [driven]);
    expect(completionFor(scene, ref(second, NAND_OUT), ref(third, NAND_A))).toEqual({
      type: "illegal",
      reason: { type: "InputAlreadyDriven", instanceId: third.id },
    });
  });
});

describe("completionFor with a bus target", () => {
  it("a 1-bit armed pin finds a 4-bit pin legal and asks for a bit", () => {
    const source = nandAt(0, 0);
    const out = bus("q", "output");
    const taken = wire(ref(source, NAND_OUT), ref(out.piece, 0, 1));
    const scene = sceneWith([out.def], [source, out.piece], [taken]);
    expect(legalTargets(scene, ref(source, NAND_OUT)).has(pinLevelKey(out.piece.id, 0))).toBe(true);
    expect(completionFor(scene, ref(source, NAND_OUT), ref(out.piece, 0))).toEqual({
      type: "pickBit",
      bus: "target",
      bits: [0, 2, 3],
    });
  });

  it("one free bit connects directly", () => {
    const source = nandAt(0, 0);
    const out = bus("q", "output");
    const taken = [0, 2, 3].map((bit) => wire(ref(source, NAND_OUT), ref(out.piece, 0, bit)));
    const scene = sceneWith([out.def], [source, out.piece], taken);
    expect(completionFor(scene, ref(source, NAND_OUT), ref(out.piece, 0))).toEqual({
      type: "connect",
      from: ref(source, NAND_OUT),
      to: ref(out.piece, 0, 1),
    });
  });

  it("is illegal when no bit is free", () => {
    const source = nandAt(0, 0);
    const out = bus("q", "output");
    const full = [0, 1, 2, 3].map((bit) => wire(ref(source, NAND_OUT), ref(out.piece, 0, bit)));
    const scene = sceneWith([out.def], [source, out.piece], full);
    // 1-bit to a bus goes through the bit picker, so the real reason is that every bit is taken.
    expect(completionFor(scene, ref(source, NAND_OUT), ref(out.piece, 0))).toEqual({
      type: "illegal",
      reason: { type: "InputAlreadyDriven", instanceId: out.piece.id },
    });
  });
});

describe("completionFor with bus ends", () => {
  it("bus to bus needs equal width", () => {
    const input = bus("d", "input", 4);
    const same = bus("q", "output", 4);
    const other = bus("r", "output", 8);
    const scene = sceneWith(
      [input.def, same.def, other.def],
      [input.piece, same.piece, other.piece],
    );
    expect(completionFor(scene, ref(input.piece, 0), ref(same.piece, 0)).type).toBe("connect");
    expect(completionFor(scene, ref(input.piece, 0), ref(other.piece, 0))).toEqual({
      type: "illegal",
      reason: { type: "WidthMismatch", from: 4, to: 8 },
    });
  });

  it("a tapped bit on a bus end counts as one bit when the other end is a bus", () => {
    const input = bus("d", "input");
    const out = bus("q", "output");
    const scene = sceneWith([input.def, out.def], [input.piece, out.piece]);
    expect(completionFor(scene, ref(input.piece, 0, 1), ref(out.piece, 0))).toEqual({
      type: "pickBit",
      bus: "target",
      bits: [0, 1, 2, 3],
    });
  });

  it("an armed bus and a 1-bit target picks on the armed end", () => {
    const input = bus("d", "input");
    const sink = nandAt(300, 0);
    const scene = sceneWith([input.def], [input.piece, sink]);
    expect(completionFor(scene, ref(input.piece, 0), ref(sink, NAND_A))).toEqual({
      type: "pickBit",
      bus: "armed",
      bits: [0, 1, 2, 3],
    });
  });

  it("a source bus fans out, and a tapped bit connects directly", () => {
    const input = bus("d", "input");
    const sink = nandAt(300, 0);
    const other = nandAt(600, 0);
    const taken = wire(ref(input.piece, 0, 0), ref(other, NAND_A));
    const scene = sceneWith([input.def], [input.piece, sink, other], [taken]);
    // A source may fan out, so both bits stay offered.
    expect(completionFor(scene, ref(input.piece, 0), ref(sink, NAND_A)).type).toBe("pickBit");
    expect(completionFor(scene, ref(input.piece, 0, 1), ref(sink, NAND_A)).type).toBe("connect");
  });
});

describe("completionFor with missing pins", () => {
  it("is illegal for a missing pin or an unknown instance", () => {
    const source = nandAt(0, 0);
    const scene = sceneWith([], [source]);
    expect(completionFor(scene, ref(source, NAND_OUT), ref(source, 9))).toEqual({
      type: "illegal",
      reason: { type: "InvalidEndpoint", instanceId: source.id, pin: 9 },
    });
    const stranger = ref(nandAt(5, 5), NAND_OUT);
    expect(completionFor(scene, stranger, ref(source, NAND_A)).type).toBe("illegal");
  });
});

describe("usedBits", () => {
  it("usedBits lists tapped bits of a bus pin", () => {
    const source = nandAt(0, 0);
    const out = bus("q", "output");
    const wires = [3, 1, 3].map((bit) => wire(ref(source, NAND_OUT), ref(out.piece, 0, bit)));
    const scene = sceneWith([out.def], [source, out.piece], wires);
    expect(usedBits(scene, out.piece.id, 0)).toEqual([1, 3]);
    expect(usedBits(scene, source.id, NAND_OUT)).toEqual([]);
  });

  it("a whole-bus wire uses every bit", () => {
    const input = bus("d", "input");
    const out = bus("q", "output");
    const whole = wire(ref(input.piece, 0), ref(out.piece, 0), 4);
    const scene = sceneWith([input.def, out.def], [input.piece, out.piece], [whole]);
    expect(usedBits(scene, out.piece.id, 0)).toEqual([0, 1, 2, 3]);
    expect(usedBits(scene, input.piece.id, 0)).toEqual([0, 1, 2, 3]);
  });
});

const driven = (bits: readonly number[]) => {
  const source = nandAt(0, 0);
  const out = bus("q", "output");
  const wires = bits.map((bit) => wire(ref(source, NAND_OUT), ref(out.piece, 0, bit)));
  return { source, out, scene: sceneWith([out.def], [source, out.piece], wires) };
};

describe("armed bus sink", () => {
  it("connects directly on the armed end when one bit is free", () => {
    const { source, out, scene } = driven([0, 2, 3]);
    expect(completionFor(scene, ref(out.piece, 0), ref(source, NAND_OUT))).toEqual({
      type: "connect",
      from: ref(source, NAND_OUT),
      to: ref(out.piece, 0, 1),
    });
  });

  it("picks on the armed end among the free bits", () => {
    const { source, out, scene } = driven([0, 3]);
    expect(completionFor(scene, ref(out.piece, 0), ref(source, NAND_OUT))).toEqual({
      type: "pickBit",
      bus: "armed",
      bits: [1, 2],
    });
  });
});

const mixedScene = () => {
  const first = nandAt(0, 0);
  const second = nandAt(300, 0);
  const input = bus("d", "input");
  const out = bus("q", "output");
  const taken = wire(ref(first, NAND_OUT), ref(out.piece, 0, 1));
  const scene = sceneWith([input.def, out.def], [first, second, input.piece, out.piece], [taken]);
  return { scene, armed: [ref(first, NAND_OUT), ref(second, NAND_A), ref(input.piece, 0)] };
};

describe("legalTargets agrees with completionFor", () => {
  it("lists a pin exactly when its completion is not illegal", () => {
    const { scene, armed } = mixedScene();
    const mismatches = armed.flatMap((from) => {
      const targets = legalTargets(scene, from);
      return scene.circuit.instances.flatMap((instance) =>
        pinKeys(scene.project, instance).filter((pin) => {
          const completion = completionFor(scene, from, { instanceId: instance.id, pin });
          return targets.has(pinLevelKey(instance.id, pin)) !== (completion.type !== "illegal");
        }),
      );
    });
    expect(mismatches).toEqual([]);
  });
});
