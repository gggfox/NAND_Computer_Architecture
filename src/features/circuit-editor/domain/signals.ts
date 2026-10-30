import type { ChipInstance, Circuit, PinDef, PinKey, PinRef, Wire } from "~/features/projects";
import type { InstanceId, PinId } from "~/shared/ids";

export type Level = 0 | 1;

/**
 * What the main thread knows: the input values it set, the output values the engine reported and,
 * once the engine reports probes, the value on each pin of the open chip's parts (`pinLevelKey`).
 */
export interface KnownLevels {
  readonly inputs: ReadonlyMap<PinId, number>;
  readonly outputs: ReadonlyMap<PinId, number>;
  readonly levels?: ReadonlyMap<string, number>;
}

/** The key of one instance pin in `KnownLevels.levels`. */
export const pinLevelKey = (instanceId: InstanceId, pin: PinKey): string =>
  `${instanceId}:${String(pin)}`;

/** A pin's probed value, bits packed bit 0 first; `undefined` until the engine reports it. */
export const pinValue = (
  known: KnownLevels,
  instanceId: InstanceId,
  pin: PinKey,
): number | undefined => known.levels?.get(pinLevelKey(instanceId, pin));

const pinDefAt = (circuit: Circuit, instanceId: InstanceId): PinDef | undefined => {
  const instance = circuit.instances.find((item) => item.id === instanceId);
  if (instance?.kind.type !== "pin") {
    return undefined;
  }
  const { pinId } = instance.kind;
  return circuit.pins.find((pin) => pin.id === pinId);
};

const asLevel = (value: number): Level => (value === 0 ? 0 : 1);

/**
 * The level on a 1-bit pin piece: an input reads as its set value (0 until set), an output as
 * its last reported value. Wider pins and any other part have no single level.
 */
const levelOf = (
  circuit: Circuit,
  known: KnownLevels,
  instanceId: InstanceId,
): Level | undefined => {
  const pin = pinDefAt(circuit, instanceId);
  if (pin?.width !== 1) {
    return undefined;
  }
  if (pin.direction === "input") {
    return asLevel(known.inputs.get(pin.id) ?? 0);
  }
  const reported = known.outputs.get(pin.id);
  return reported === undefined ? undefined : asLevel(reported);
};

const isOutputPiece = (circuit: Circuit, instanceId: InstanceId): boolean =>
  pinDefAt(circuit, instanceId)?.direction === "output";

/**
 * The level on a driving pin, when the main thread knows it: an input piece drives its own
 * level; any other source is known only when one of its wires feeds an output the engine reported.
 */
const sourceLevel = (circuit: Circuit, known: KnownLevels, source: PinRef): Level | undefined => {
  if (pinDefAt(circuit, source.instanceId)?.direction === "input") {
    return levelOf(circuit, known, source.instanceId);
  }
  const reported = circuit.wires.find(
    (wire) =>
      wire.from.instanceId === source.instanceId &&
      wire.from.pin === source.pin &&
      wire.from.bit === source.bit &&
      isOutputPiece(circuit, wire.to.instanceId),
  );
  return reported === undefined ? undefined : levelOf(circuit, known, reported.to.instanceId);
};

const DASH_ON_PX = 6;
const DASH_OFF_PX = 4;
const SOLID: readonly number[] = [];
const LOW_DASH: readonly number[] = [DASH_ON_PX, DASH_OFF_PX];

/** Low wires are dashed, so wire state is never shown by colour alone (WCAG 1.4.1). */
export const wireDash = (level?: Level): readonly number[] => (level === 0 ? LOW_DASH : SOLID);

/** The probed level of a 1-bit wire end: a tap reads its bit; a whole bus has no single level. */
const probedLevel = (known: KnownLevels, wire: Wire): Level | undefined => {
  const value = pinValue(known, wire.from.instanceId, wire.from.pin);
  if (value === undefined || (wire.from.bit === undefined && wire.bitWidth !== 1)) {
    return undefined;
  }
  return asLevel((value >> (wire.from.bit ?? 0)) & 1);
};

export const wireLevel = (circuit: Circuit, known: KnownLevels, wire: Wire): Level | undefined =>
  probedLevel(known, wire) ?? sourceLevel(circuit, known, wire.from);

/** The level shown on a chip body: 1-bit inputs and outputs have one; other parts have none. */
export const instanceLevel = (
  circuit: Circuit,
  known: KnownLevels,
  instance: ChipInstance,
): Level | undefined => levelOf(circuit, known, instance.id);
