import type { ChipInstance, PinRef } from "~/features/projects";
import type { InstanceId } from "~/shared/ids";

import { partOf, pinPosition } from "./geometry";
import type { Scene } from "./geometry";

const same = (a: PinRef, b: PinRef): boolean => a.instanceId === b.instanceId && a.pin === b.pin;

/** Pins as a selection keeps them: a whole pin, never one bit of it. */
const whole = ({ instanceId, pin }: PinRef): PinRef => ({ instanceId, pin });

export const hasPin = (pins: readonly PinRef[], pin: PinRef): boolean =>
  pins.some((item) => same(item, pin));

/** `pins` with `pin` appended, or without it if it was there (D2). */
export const togglePinIn = (pins: readonly PinRef[], pin: PinRef): readonly PinRef[] =>
  hasPin(pins, pin) ? pins.filter((item) => !same(item, pin)) : [...pins, whole(pin)];

/** `pins` followed by those of `more` not already in it. */
export const appendPins = (pins: readonly PinRef[], more: readonly PinRef[]): readonly PinRef[] => {
  const all = [...pins];
  for (const pin of more) {
    if (!hasPin(all, pin)) {
      all.push(whole(pin));
    }
  }
  return all;
};

/** What makes two chips the same kind: a chip's id, a bus part's width, a pin piece's direction. */
const kindKey = (scene: Scene, instance: ChipInstance): string => {
  const { kind } = instance;
  if (kind.type === "custom") {
    return `custom:${kind.chipId}`;
  }
  if (kind.type === "split" || kind.type === "merge") {
    return `${kind.type}:${String(kind.width)}`;
  }
  return kind.type === "pin" ? `pin:${partOf(scene.circuit, instance)}` : kind.type;
};

/**
 * `like`'s pin (by key) on every chip of `like`'s kind among `instanceIds`, in reading order
 * (D3): top to bottom by anchor, then left to right, then instance order.
 */
export const samePinOn = (
  scene: Scene,
  { like, instanceIds }: { readonly like: PinRef; readonly instanceIds: ReadonlySet<InstanceId> },
): readonly PinRef[] => {
  const { instances } = scene.circuit;
  const model = instances.find((item) => item.id === like.instanceId);
  if (model === undefined) {
    return [];
  }
  return instances
    .flatMap((instance, order) => {
      const anchor =
        instanceIds.has(instance.id) && kindKey(scene, model) === kindKey(scene, instance)
          ? pinPosition(scene, instance, like.pin)
          : undefined;
      return anchor === undefined ? [] : [{ instance, anchor, order }];
    })
    .toSorted((a, b) => a.anchor.y - b.anchor.y || a.anchor.x - b.anchor.x || a.order - b.order)
    .map(({ instance }) => ({ instanceId: instance.id, pin: like.pin }));
};
