import { m } from "~/i18n/paraglide/messages";
import { assertNever } from "~/shared/assert-never";
import type { InstanceId } from "~/shared/ids";

import { layoutIn } from "./geometry";
import type { Scene } from "./geometry";
import type { Announcement } from "./interaction";
import { pinInfo } from "./pin-info";
import type { KnownLevels } from "./signals";

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

const selectedText = (
  scene: Scene,
  announcement: Extract<Announcement, { type: "selected" }>,
): string => {
  const [only, ...rest] = announcement.instanceIds;
  return only !== undefined && rest.length === 0 && announcement.wires === 0
    ? m.canvas_selected_one({ name: chipLabel(scene, only) })
    : m.canvas_selected_many({ count: announcement.instanceIds.length + announcement.wires });
};

const pinText = (
  scene: Scene,
  known: KnownLevels,
  announcement: Extract<Announcement, { type: "pin" }>,
): string => {
  const info = pinInfo(scene, known, [announcement.instanceId, announcement.pin]);
  return info === undefined
    ? ""
    : m.canvas_pin({
        name: info.name,
        chip: chipLabel(scene, announcement.instanceId),
        value: info.valueText,
        count: info.connections.length,
      });
};

const armedText = (
  scene: Scene,
  known: KnownLevels,
  announcement: Extract<Announcement, { type: "armed" }>,
): string => {
  const info = pinInfo(scene, known, [announcement.instanceId, announcement.pin]);
  return info === undefined
    ? ""
    : m.canvas_armed({ pin: info.name, chip: chipLabel(scene, announcement.instanceId) });
};

type WiringAnnouncement = Extract<Announcement, { type: "armed" | "wired" | "disarmed" | "bends" }>;

const WIRING_TYPES: ReadonlySet<Announcement["type"]> = new Set([
  "armed",
  "wired",
  "disarmed",
  "bends",
]);

const isWiring = (announcement: Announcement): announcement is WiringAnnouncement =>
  WIRING_TYPES.has(announcement.type);

/** The wiring announcements: a pin armed, a wire added, wiring cancelled, bend mode on or off. */
const wiringText = (scene: Scene, known: KnownLevels, announcement: WiringAnnouncement): string => {
  switch (announcement.type) {
    case "armed": {
      return armedText(scene, known, announcement);
    }
    case "wired": {
      return m.canvas_wired();
    }
    case "disarmed": {
      return m.canvas_disarmed();
    }
    case "bends": {
      return announcement.active ? m.canvas_bends() : m.canvas_bends_done();
    }
    default: {
      return assertNever(announcement);
    }
  }
};

/** The live region's words for an announcement (ADR 3, 17). */
export const announcementText = (
  scene: Scene,
  known: KnownLevels,
  announcement: Announcement,
): string => {
  if (isWiring(announcement)) {
    return wiringText(scene, known, announcement);
  }
  switch (announcement.type) {
    case "selected": {
      return selectedText(scene, announcement);
    }
    case "cleared": {
      return m.canvas_selection_cleared();
    }
    case "moved": {
      return m.canvas_moved({ count: announcement.count });
    }
    case "deleted": {
      return m.canvas_deleted({ count: announcement.count });
    }
    case "tool": {
      return announcement.tool === "pan" ? m.canvas_tool_pan() : m.canvas_tool_select();
    }
    case "pin": {
      return pinText(scene, known, announcement);
    }
    default: {
      return assertNever(announcement);
    }
  }
};
