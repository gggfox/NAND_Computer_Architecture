/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import {
  createDemoProject,
  EMPTY_CIRCUIT,
  newChip,
  piece,
  pinDef,
  pinPiece,
  projectWith,
  wire,
} from "~/features/projects";
import type { Circuit, Project } from "~/features/projects";
import { newInstanceId } from "~/shared/ids";

import { layoutOf } from "./chip-layout";
import type { Scene } from "./geometry";
import { structureOf } from "./structure";

const sceneOf = (project: Project, circuit: Circuit): Scene => ({ project, circuit });

const demo = (): Scene => {
  const project = createDemoProject("demo");
  return sceneOf(project, project.chips[0]?.draft ?? EMPTY_CIRCUIT);
};

const wireLabels = (scene: Scene): readonly string[] =>
  structureOf(scene).wires.map((entry) => entry.label);

const pinNames = (scene: Scene, index: number): readonly string[] =>
  (structureOf(scene).parts[index]?.pins ?? []).map((pin) => pin.name);

describe("structureOf: the demo circuit", () => {
  const structure = structureOf(demo());

  it("lists the four parts in canvas order with the summary labels", () => {
    expect(structure.parts.map((part) => part.label)).toEqual([
      "Input A",
      "Input B",
      "NAND gate 1",
      "Output OUT",
    ]);
    expect(structure.parts.map((part) => part.kind)).toEqual(["input", "input", "nand", "output"]);
  });

  it("lists the three wires in the reading order of their sinks", () => {
    expect(structure.wires.map((entry) => entry.label)).toEqual([
      "Wire from A of Input A to a of NAND gate 1",
      "Wire from out of NAND gate 1 to OUT of Output OUT",
      "Wire from B of Input B to b of NAND gate 1",
    ]);
  });

  it("gives the NAND its pins with names, directions and widths", () => {
    const nand = structure.parts.at(2);
    expect(nand?.pins.map(({ name, direction, width }) => [name, direction, width])).toEqual([
      ["a", "input", 1],
      ["b", "input", 1],
      ["out", "output", 1],
    ]);
  });

  it("carries the pin id of a pin piece and no custom id", () => {
    const [first, , nand] = structure.parts;
    expect(first?.pinId).toBeDefined();
    expect(first?.custom).toBeUndefined();
    expect(nand?.pinId).toBeUndefined();
  });
});

describe("structureOf: wires", () => {
  it("names both ends by pin and part", () => {
    const [first] = structureOf(demo()).wires;
    expect(first?.label).toBe("Wire from A of Input A to a of NAND gate 1");
  });

  it("lists wires in the reading order of their sink", () => {
    const scene = demo();
    const reversed = { ...scene.circuit, wires: scene.circuit.wires.toReversed() };
    expect(wireLabels(sceneOf(scene.project, reversed))).toEqual(wireLabels(scene));
  });

  it("keeps the wire colour only when it is set", () => {
    const scene = demo();
    const [first, ...rest] = scene.circuit.wires;
    const coloured = {
      ...scene.circuit,
      wires: first === undefined ? [] : [{ ...first, color: "red" as const }, ...rest],
    };
    const entries = structureOf(sceneOf(scene.project, coloured)).wires;
    expect(entries.filter((entry) => entry.color === "red")).toHaveLength(1);
    expect(entries.filter((entry) => !("color" in entry))).toHaveLength(2);
  });

  it("names an end whose part is gone by its pin key", () => {
    const scene = demo();
    const ghost = { instanceId: newInstanceId(), pin: 0 };
    const broken = { ...scene.circuit, wires: [wire(ghost, ghost)] };
    const [entry] = structureOf(sceneOf(scene.project, broken)).wires;
    expect(entry?.label).toBe("Wire from 0 of  to 0 of ");
  });
});

describe("structureOf: pins and connections", () => {
  it("gives each pin the part across its wire", () => {
    const connections = structureOf(demo()).parts.map((part) =>
      part.pins.map((pin) => pin.connections),
    );
    expect(connections).toEqual([
      [["a of NAND gate 1"]],
      [["b of NAND gate 1"]],
      [["A of Input A"], ["B of Input B"], ["OUT of Output OUT"]],
      [["out of NAND gate 1"]],
    ]);
  });

  it("gives a pin with no wire no connections", () => {
    const scene = demo();
    const bare = { ...scene.circuit, wires: [] };
    const pins = structureOf(sceneOf(scene.project, bare)).parts.flatMap((part) => part.pins);
    expect(pins).toHaveLength(6);
    expect(pins.every((pin) => pin.connections.length === 0)).toBe(true);
  });

  it("lists every sink of a fan-out", () => {
    const scene = demo();
    const [inputA] = scene.circuit.instances;
    const extra = piece({ type: "nand" }, { x: 600, y: 200 });
    const fan = {
      ...scene.circuit,
      instances: [...scene.circuit.instances, extra],
      wires: [
        ...scene.circuit.wires,
        wire({ instanceId: inputA?.id ?? extra.id, pin: 0 }, { instanceId: extra.id, pin: 0 }),
      ],
    };
    const [first] = structureOf(sceneOf(scene.project, fan)).parts;
    expect(first?.pins[0]?.connections).toEqual(["a of NAND gate 1", "a of NAND gate 2"]);
  });

  it("numbers same-titled parts in canvas order", () => {
    const scene = demo();
    const extra = piece({ type: "nand" }, { x: 600, y: 200 });
    const more = { ...scene.circuit, instances: [...scene.circuit.instances, extra] };
    const labels = structureOf(sceneOf(scene.project, more)).parts.map((part) => part.label);
    expect(labels).toEqual(["Input A", "Input B", "NAND gate 1", "Output OUT", "NAND gate 2"]);
  });
});

const busScene = (): Scene => {
  const bus = pinDef("D", "input", 4);
  const tap = pinPiece(bus, { x: 0, y: 0 });
  const nand = piece({ type: "nand" }, { x: 300, y: 0 });
  const circuit = {
    pins: [bus],
    instances: [tap, nand],
    wires: [wire({ instanceId: tap.id, pin: 0, bit: 2 }, { instanceId: nand.id, pin: 0 })],
  };
  return sceneOf(projectWith("bus", [newChip("bus", circuit)]), circuit);
};

describe("structureOf: a bit tap", () => {
  it("shows the bit in the wire label and in both pins' connections", () => {
    const structure = structureOf(busScene());
    expect(structure.wires[0]?.label).toBe("Wire from D[4] bit 2 of Input D to a of NAND gate 1");
    const [tap, nand] = structure.parts;
    expect(tap?.pins[0]?.connections).toEqual(["a of NAND gate 1"]);
    expect(nand?.pins[0]?.connections).toEqual(["D[4] bit 2 of Input D"]);
    expect(tap?.pins[0]?.width).toBe(4);
  });
});

const withCustom = () => {
  const inner = pinDef("IN", "input", 8);
  const out = pinDef("Q", "output");
  const innerCircuit = { pins: [inner, out], instances: [], wires: [] };
  const saved = newChip("REG", innerCircuit, { saved: true });
  const instance = piece({ type: "custom", chipId: saved.id }, { x: 0, y: 0 });
  const hostCircuit = { pins: [], instances: [instance], wires: [] };
  const host = newChip("host", hostCircuit);
  return { saved, instance, scene: sceneOf(projectWith("p", [host, saved]), hostCircuit) };
};

describe("structureOf: custom chips", () => {
  it("lists its saved pins with names and widths", () => {
    const { saved, scene } = withCustom();
    const [part] = structureOf(scene).parts;
    expect(part?.kind).toBe("custom");
    expect(part?.custom).toBe(saved.id);
    expect(part?.label).toBe("REG 1");
    expect(part?.pins.map(({ name, width, direction }) => [name, width, direction])).toEqual([
      ["IN[8]", 8, "input"],
      ["Q", 1, "output"],
    ]);
  });

  it("calls a clock, split or merge part other", () => {
    const parts = [
      piece({ type: "clock" }),
      piece({ type: "split", width: 4 }),
      piece({ type: "merge", width: 4 }),
    ];
    const circuit = { pins: [], instances: parts, wires: [] };
    const scene = sceneOf(projectWith("p", [newChip("p", circuit)]), circuit);
    expect(structureOf(scene).parts.map((part) => part.kind)).toEqual(["other", "other", "other"]);
    expect(pinNames(scene, 0)).toEqual(["out"]);
  });
});

describe("structureOf: purity", () => {
  it("does not change the scene", () => {
    const scene = demo();
    const before = JSON.stringify(scene);
    structureOf(scene);
    expect(JSON.stringify(scene)).toBe(before);
  });

  it("reads a drag preview position", () => {
    const scene = demo();
    const [first] = scene.circuit.instances;
    const positions = new Map([[first?.id ?? newInstanceId(), { x: 5, y: 5 }]]);
    expect(structureOf({ ...scene, positions })).toEqual(structureOf(scene));
  });

  it("uses the layout cache of the scene", () => {
    const scene = demo();
    let calls = 0;
    const layout: NonNullable<Scene["layout"]> = (source, instance) => {
      calls += 1;
      return layoutOf(source, instance);
    };
    structureOf({ ...scene, layout });
    expect(calls).toBeGreaterThan(0);
  });
});
