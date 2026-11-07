import type { PinRef } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";

import { createLayoutCache } from "./chip-layout";
import { layoutIn } from "./geometry";
import type { Scene } from "./geometry";
import { readingOrder } from "./pin-selection";
import { structureOf } from "./structure";
import { completionFor, sideWidth } from "./wiring-targets";

/** One pin that a wire from `from` may reach, as the "Wire to…" dialog lists it. */
export interface WireTarget {
  readonly ref: PinRef;
  /** "{pin} of {part}", as the canvas and the structure view say it. */
  readonly label: string;
  /** The pin's width in bits. */
  readonly width: number;
  /**
   * How many bits the dialog must choose from on this pin. It is `width` when the pin is a bus
   * and `from` is one bit: the wire needs a bit on this end. Otherwise it is 1. When `from` is
   * a bus and this pin is one bit, the dialog asks for the bit on the `from` end.
   */
  readonly bits: number;
}

/**
 * Every pin that a wire from `from` may reach, in reading order of the pin. When `from` is an
 * input, these are the outputs that may drive it. The canvas rule decides (`completionFor`), so
 * no illegal pin is listed. A pin on the same part is not listed. The scene is only read.
 */
export const wireTargets = (source: Scene, from: PinRef): readonly WireTarget[] => {
  const scene: Scene = { ...source, layout: source.layout ?? createLayoutCache() };
  const fromWidth = sideWidth(scene, from);
  const { parts } = structureOf(scene);
  const found = scene.circuit.instances.flatMap((instance, order) =>
    parts.slice(order, order + 1).flatMap((part) =>
      layoutIn(scene, instance)
        .pins.flatMap(({ anchor }, index) =>
          part.pins.slice(index, index + 1).map((pin) => ({ anchor, pin })),
        )
        .filter(
          ({ pin }) =>
            instance.id !== from.instanceId &&
            completionFor(scene, from, pin.ref).type !== "illegal",
        )
        .map(({ anchor, pin }) => ({
          anchor,
          order,
          target: {
            ref: pin.ref,
            label: m.canvas_wire_end({ pin: pin.name, chip: part.label }),
            width: pin.width,
            bits: pin.width > 1 && fromWidth === 1 ? pin.width : 1,
          },
        })),
    ),
  );
  return found.toSorted(readingOrder).map(({ target }) => target);
};
