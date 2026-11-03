/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { newChip, pinDef, pinPiece, piece, projectWith } from "~/features/projects";
import type { BitWidth, Chip, ChipInstance, Circuit, PinDef, PinRef } from "~/features/projects";

import { createLayoutCache } from "./chip-layout";
import type { Scene } from "./geometry";
import type { Proposal } from "./suggest-wires";

const STEP = 80;

export type Spec = readonly [string, BitWidth?];

/** A saved chip with the given input and output pins, in that order. */
export const savedChip = (name: string, ins: readonly Spec[], outs: readonly Spec[]): Chip => {
  const inputs = ins.map(([pin, width]) => pinDef(pin, "input", width));
  const outputs = outs.map(([pin, width]) => pinDef(pin, "output", width));
  const pins = [...inputs, ...outputs];
  const circuit: Circuit = { pins, instances: pins.map((def) => pinPiece(def)), wires: [] };
  return newChip(name, circuit, { saved: true });
};

/** A part of `chip` at height `y`. */
export const partOf = (chip: Chip, y = 0): ChipInstance =>
  piece({ type: "custom", chipId: chip.id }, { x: 0, y });

interface Extras {
  readonly pins?: readonly PinDef[];
  readonly wires?: Circuit["wires"];
}

/** A scene whose open chip holds `instances`, with `chips` saved beside it. */
export const sceneOf = (
  chips: readonly Chip[],
  instances: readonly ChipInstance[],
  { pins = [], wires = [] }: Extras = {},
): Scene => {
  const circuit: Circuit = { pins, instances, wires };
  return {
    project: projectWith("p", [newChip("Main", circuit), ...chips]),
    circuit,
    layout: createLayoutCache(),
  };
};

/** Input pieces for the definitions, stacked down the left edge. */
export const inputPieces = (pins: readonly PinDef[]): readonly ChipInstance[] =>
  pins.map((def, index) => pinPiece(def, { x: -200, y: index * STEP }));

/** The pin definitions an instance's pins are named by: the saved chip's, or the open circuit's. */
const definitionsOf = (scene: Scene, instance: ChipInstance | undefined): readonly PinDef[] => {
  const kind = instance?.kind;
  return kind?.type === "custom"
    ? (scene.project.chips.find((chip) => chip.id === kind.chipId)?.saved?.pins ?? [])
    : scene.circuit.pins;
};

const nameOf = (scene: Scene, ref: PinRef): string => {
  const instance = scene.circuit.instances.find((item) => item.id === ref.instanceId);
  const wanted = instance?.kind.type === "pin" ? instance.kind.pinId : ref.pin;
  return definitionsOf(scene, instance).find((def) => def.id === wanted)?.name ?? String(ref.pin);
};

/** `instanceIndex.pinName[bit]` for each end, so expectations read as wires. */
export const shown = (scene: Scene, proposals: readonly Proposal[]): readonly string[] => {
  const label = (ref: PinRef) => {
    const index = scene.circuit.instances.findIndex((item) => item.id === ref.instanceId);
    const bit = ref.bit === undefined ? "" : `[${String(ref.bit)}]`;
    return `${String(index)}.${nameOf(scene, ref)}${bit}`;
  };
  return proposals.map(({ from, to }) => `${label(from)} > ${label(to)}`);
};
