import type { ChipInstance, Circuit, PinRef, Wire } from "~/features/projects";
import type { InstanceId } from "~/shared/ids";

import { partOf } from "./geometry";
import type { Part } from "./geometry";

export type Level = 0 | 1;

/** What the main thread knows: the input levels it set and the output levels the engine reported. */
export interface KnownLevels {
  readonly inputs: readonly Level[];
  readonly outputs: readonly Level[];
}

/** Position of an instance among the parts of its kind, which is its engine index. */
const indexAmong = (circuit: Circuit, part: Part, instanceId: InstanceId): number =>
  circuit.instances
    .filter((item) => partOf(circuit, item) === part)
    .findIndex((item) => item.id === instanceId);

const partAt = (circuit: Circuit, instanceId: InstanceId): Part | undefined => {
  const instance = circuit.instances.find((item) => item.id === instanceId);
  return instance === undefined ? undefined : partOf(circuit, instance);
};

const levelOf = (
  circuit: Circuit,
  known: KnownLevels,
  instanceId: InstanceId,
): Level | undefined => {
  const part = partAt(circuit, instanceId);
  if (part === "input") {
    return known.inputs[indexAmong(circuit, "input", instanceId)];
  }
  return part === "output" ? known.outputs[indexAmong(circuit, "output", instanceId)] : undefined;
};

/**
 * The level on a driving pin, when the main thread knows it: an `input` drives its own level;
 * any other source is known only when one of its wires feeds an `output` the engine reported.
 */
const sourceLevel = (circuit: Circuit, known: KnownLevels, source: PinRef): Level | undefined => {
  if (partAt(circuit, source.instanceId) === "input") {
    return levelOf(circuit, known, source.instanceId);
  }
  const reported = circuit.wires.find(
    (wire) =>
      wire.from.instanceId === source.instanceId &&
      wire.from.pin === source.pin &&
      partAt(circuit, wire.to.instanceId) === "output",
  );
  return reported === undefined ? undefined : levelOf(circuit, known, reported.to.instanceId);
};

const DASH_ON_PX = 6;
const DASH_OFF_PX = 4;
const SOLID: readonly number[] = [];
const LOW_DASH: readonly number[] = [DASH_ON_PX, DASH_OFF_PX];

/** Low wires are dashed, so wire state is never shown by colour alone (WCAG 1.4.1). */
export const wireDash = (level?: Level): readonly number[] => (level === 0 ? LOW_DASH : SOLID);

export const wireLevel = (circuit: Circuit, known: KnownLevels, wire: Wire): Level | undefined =>
  sourceLevel(circuit, known, wire.from);

/** The level shown on a chip body: inputs and outputs have one; other parts have none. */
export const instanceLevel = (
  circuit: Circuit,
  known: KnownLevels,
  instance: ChipInstance,
): Level | undefined => levelOf(circuit, known, instance.id);
