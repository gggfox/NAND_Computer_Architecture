import { checkConnection, endpointInfo, wire } from "~/features/projects";
import type { Circuit, PinRef, Wire } from "~/features/projects";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { Scene } from "./geometry";
import type { BulkRefusal } from "./pin-selection";
import { sideWidth } from "./wiring-targets";

export interface PlannedWire {
  readonly from: PinRef;
  readonly to: PinRef;
}

export interface BulkPlan {
  readonly wires: readonly PlannedWire[];
  /** For the announcement: fan-out, or the bits used. */
  readonly shape:
    | { readonly type: "fanOut" }
    | { readonly type: "bits"; readonly first: number; readonly last: number };
}

interface Request {
  readonly source: PinRef;
  readonly pins: readonly PinRef[];
}

/** How the pins are wired: one bit each or whole, and whether they feed the source (D5). */
interface Mode {
  readonly bits: boolean;
  readonly reverse: boolean;
}

const refuse = (reason: BulkRefusal["reason"], at: PinRef): Result<never, BulkRefusal> =>
  err({ reason, at });

const samePin = (a: PinRef, b: PinRef): boolean => a.instanceId === b.instanceId && a.pin === b.pin;

interface Side {
  readonly role: "source" | "sink";
  readonly width: number;
}

interface Sides {
  readonly source: Side;
  readonly pins: readonly Side[];
}

/** Role and width of a pin as a wire sees them, or an invalid endpoint at a pin not there. */
const sideAt = (scene: Scene, ref: PinRef): Result<Side, BulkRefusal> => {
  const instance = scene.circuit.instances.find((item) => item.id === ref.instanceId);
  const info = instance && endpointInfo(scene.project, scene.circuit, instance, ref.pin);
  return info === undefined
    ? refuse({ type: "InvalidEndpoint", instanceId: ref.instanceId, pin: ref.pin }, ref)
    : ok({ role: info.role, width: sideWidth(scene, ref) });
};

const sidesOf = (scene: Scene, { source, pins }: Request): Result<Sides, BulkRefusal> => {
  const from = sideAt(scene, source);
  const sides: Side[] = [];
  for (const pin of pins) {
    const side = sideAt(scene, pin);
    if (!side.ok) {
      return side;
    }
    sides.push(side.value);
  }
  return from.ok ? ok({ source: from.value, pins: sides }) : from;
};

/** Mixed widths or directions, or the source's own direction: the first pin to blame. */
const breach = ({ pins }: Request, sides: Sides): BulkRefusal | undefined => {
  const [first] = sides.pins;
  const odd = pins.find((_pin, index) => {
    const side = sides.pins[index];
    return side?.role !== first?.role || side?.width !== first?.width;
  });
  const [firstPin] = pins;
  if (odd !== undefined) {
    return { reason: { type: "MixedPins" }, at: odd };
  }
  return first?.role === sides.source.role && firstPin !== undefined
    ? { reason: { type: "SameDirection" }, at: firstPin }
    : undefined;
};

/** One bit per pin, or whole pins; into the source or out of it; or too many pins (D5). */
const modeOf = ({ source, pins }: Request, sides: Sides): Result<Mode, BulkRefusal> => {
  const bitWidth = sides.source.width;
  const bits = sides.pins[0]?.width === 1 && bitWidth > 1;
  const [, second] = pins;
  if (bits && pins.length > bitWidth) {
    const reason = { type: "TooManyPins", pins: pins.length, bits: bitWidth } as const;
    return refuse(reason, pins[bitWidth] ?? source);
  }
  const reverse = sides.source.role === "sink";
  return reverse && !bits && second !== undefined
    ? refuse({ type: "InputTakesOneWire" }, second)
    : ok({ bits, reverse });
};

/** The case the selection falls under, or the first refusal (D5). */
const classify = (scene: Scene, request: Request): Result<Mode, BulkRefusal> => {
  if (request.pins.some((pin) => samePin(pin, request.source))) {
    return refuse({ type: "SourceSelected" }, request.source);
  }
  const sides = sidesOf(scene, request);
  if (!sides.ok) {
    return sides;
  }
  const refusal = breach(request, sides.value);
  return refusal === undefined ? modeOf(request, sides.value) : err(refusal);
};

/** The planned ends, as (selected pin, ends) so a refusal can name the pin. */
const pairs = (
  { source, pins }: Request,
  { bits, reverse }: Mode,
): readonly { readonly pin: PinRef; readonly ends: readonly [PinRef, PinRef] }[] =>
  pins.map((pin, index) => {
    const end = bits ? { ...source, bit: index } : source;
    return { pin, ends: reverse ? [pin, end] : [end, pin] };
  });

/** Checks each pair against the circuit plus the wires before it; stops at the first error. */
const checkAll = (
  scene: Scene,
  planned: ReturnType<typeof pairs>,
): Result<readonly PlannedWire[], BulkRefusal> => {
  const drafted: Wire[] = [];
  for (const { pin, ends } of planned) {
    const draft: Circuit = { ...scene.circuit, wires: [...scene.circuit.wires, ...drafted] };
    const checked = checkConnection(scene.project, draft, ends[0], ends[1]);
    if (!checked.ok) {
      return refuse(checked.error, pin);
    }
    const { from, to, bitWidth } = checked.value;
    drafted.push(wire(from, to, bitWidth));
  }
  return ok(drafted.map(({ from, to }) => ({ from, to })));
};

/**
 * The wires that join `pins` to `source` in one go (D5), or the first reason they cannot be (D6).
 * Never changes the scene.
 */
export const planBulkWires = (scene: Scene, request: Request): Result<BulkPlan, BulkRefusal> => {
  if (request.pins.length === 0) {
    return ok({ wires: [], shape: { type: "fanOut" } });
  }
  const mode = classify(scene, request);
  if (!mode.ok) {
    return mode;
  }
  const wires = checkAll(scene, pairs(request, mode.value));
  const last = request.pins.length - 1;
  return wires.ok
    ? ok({
        wires: wires.value,
        shape: mode.value.bits ? { type: "bits", first: 0, last } : { type: "fanOut" },
      })
    : wires;
};
