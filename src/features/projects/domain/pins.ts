/* oxlint-disable typescript/prefer-readonly-parameter-types -- projects and circuits carry branded ids (mutable object types); none is mutated */
import { assertNever } from "~/shared/assert-never";

import type {
  BitWidth,
  BusWidth,
  ChipInstance,
  Circuit,
  InstanceKind,
  PinKey,
  Project,
} from "./model";

export type PinRole = "source" | "sink";

export interface EndpointInfo {
  readonly role: PinRole;
  readonly width: BitWidth;
}

const NAND_OUT = 2;

const info = (role: PinRole, width: BitWidth): EndpointInfo => ({ role, width });

const splitInfo = (width: BusWidth, pin: number): EndpointInfo | undefined => {
  if (pin === 0) {
    return info("sink", width);
  }
  return pin <= width ? info("source", 1) : undefined;
};

const mergeInfo = (width: BusWidth, pin: number): EndpointInfo | undefined => {
  if (pin < width) {
    return info("sink", 1);
  }
  return pin === width ? info("source", width) : undefined;
};

const nandInfo = (pin: number): EndpointInfo | undefined => {
  if (pin === NAND_OUT) {
    return info("source", 1);
  }
  return pin < NAND_OUT ? info("sink", 1) : undefined;
};

const pinPieceInfo = (circuit: Circuit, pinId: string, pin: number): EndpointInfo | undefined => {
  const def = circuit.pins.find((item) => item.id === pinId);
  if (def === undefined || pin !== 0) {
    return undefined;
  }
  return info(def.direction === "input" ? "source" : "sink", def.width);
};

const customInfo = (project: Project, chipId: string, pin: PinKey): EndpointInfo | undefined => {
  const saved = project.chips.find((chip) => chip.id === chipId)?.saved;
  const def = typeof pin === "string" ? saved?.pins.find((item) => item.id === pin) : undefined;
  return def === undefined
    ? undefined
    : info(def.direction === "input" ? "sink" : "source", def.width);
};

const builtinInfo = (
  circuit: Circuit,
  kind: Exclude<InstanceKind, { type: "custom" }>,
  pin: PinKey,
): EndpointInfo | undefined => {
  if (typeof pin !== "number" || !Number.isInteger(pin) || pin < 0) {
    return undefined;
  }
  switch (kind.type) {
    case "nand": {
      return nandInfo(pin);
    }
    case "clock": {
      return pin === 0 ? info("source", 1) : undefined;
    }
    case "split": {
      return splitInfo(kind.width, pin);
    }
    case "merge": {
      return mergeInfo(kind.width, pin);
    }
    case "pin": {
      return pinPieceInfo(circuit, kind.pinId, pin);
    }
    default: {
      return assertNever(kind);
    }
  }
};

/** Role and width of one pin of a placed instance; `undefined` when the pin does not exist. */
// oxlint-disable-next-line eslint/max-params -- project, circuit, instance and pin are all needed to resolve a pin
export const endpointInfo = (
  project: Project,
  circuit: Circuit,
  instance: ChipInstance,
  pin: PinKey,
): EndpointInfo | undefined =>
  instance.kind.type === "custom"
    ? customInfo(project, instance.kind.chipId, pin)
    : builtinInfo(circuit, instance.kind, pin);

const range = (count: number): readonly number[] =>
  Array.from({ length: count }, (_unused, index) => index);

const NAND_PINS: readonly PinKey[] = [0, 1, NAND_OUT];
const SINGLE_PIN: readonly PinKey[] = [0];

/**
 * Every pin of a placed instance, in drawing order: built-ins by number, a custom chip by the
 * saved version's Pins-panel order (no pins while it is unsaved or missing).
 */
export const pinKeys = (project: Project, instance: ChipInstance): readonly PinKey[] => {
  const { kind } = instance;
  switch (kind.type) {
    case "nand": {
      return NAND_PINS;
    }
    case "clock":
    case "pin": {
      return SINGLE_PIN;
    }
    case "split":
    case "merge": {
      return range(kind.width + 1);
    }
    case "custom": {
      const saved = project.chips.find((chip) => chip.id === kind.chipId)?.saved;
      return saved?.pins.map((pin) => pin.id) ?? [];
    }
    default: {
      return assertNever(kind);
    }
  }
};
