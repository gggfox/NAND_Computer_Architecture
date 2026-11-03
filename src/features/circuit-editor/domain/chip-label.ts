import { m } from "~/i18n/paraglide/messages";
import type { InstanceId } from "~/shared/ids";

import { layoutIn } from "./geometry";
import type { Scene } from "./geometry";

/**
 * A chip's spoken name, matching the circuit summary: a pin piece by its pin's name, a NAND as
 * "NAND gate 2", anything else as its title and number among same-titled parts in canvas order.
 */
export const chipLabel = (scene: Scene, instanceId: InstanceId): string => {
  const { instances } = scene.circuit;
  const instance = instances.find((item) => item.id === instanceId);
  if (instance === undefined) {
    return "";
  }
  const { title } = layoutIn(scene, instance);
  if (instance.kind.type === "pin") {
    return title;
  }
  const same = instances.filter(
    (item) => item.kind.type !== "pin" && layoutIn(scene, item).title === title,
  );
  const number = same.findIndex((item) => item.id === instanceId) + 1;
  return instance.kind.type === "nand"
    ? m.nand_numbered({ number })
    : m.part_numbered({ name: title, number });
};
