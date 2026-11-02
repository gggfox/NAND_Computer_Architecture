import type { PinRef } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { assertNever } from "~/shared/assert-never";
import type { InstanceId } from "~/shared/ids";

import { editorErrorMessage } from "./editor-error-messages";
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

/** A wire end as "{pin} of {chip}", or `undefined` when the pin is gone. */
const endText = (scene: Scene, known: KnownLevels, end: PinRef): string | undefined => {
  const info = pinInfo(scene, known, [end.instanceId, end.pin]);
  return info && m.canvas_wire_end({ pin: info.name, chip: chipLabel(scene, end.instanceId) });
};

const wireText = (
  scene: Scene,
  known: KnownLevels,
  announcement: Extract<Announcement, { type: "wireSelected" }>,
): string => {
  const wire = scene.circuit.wires.find((item) => item.id === announcement.wireId);
  const from = wire && endText(scene, known, wire.from);
  const to = wire && endText(scene, known, wire.to);
  return from === undefined || to === undefined ? "" : m.canvas_wire_selected({ from, to });
};

type WiringAnnouncement = Extract<
  Announcement,
  { type: "armed" | "wired" | "disarmed" | "refused" | "bends" | "wireSelected" }
>;

const WIRING_TYPES: ReadonlySet<Announcement["type"]> = new Set([
  "armed",
  "wired",
  "disarmed",
  "refused",
  "bends",
  "wireSelected",
]);

const isWiring = (announcement: Announcement): announcement is WiringAnnouncement =>
  WIRING_TYPES.has(announcement.type);

/**
 * The wiring announcements: a pin armed, a wire added, wiring cancelled, a connection refused,
 * bend mode on or off, a wire selected from the keyboard.
 */
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
    case "refused": {
      return editorErrorMessage(announcement.reason);
    }
    case "bends": {
      return announcement.active ? m.canvas_bends() : m.canvas_bends_done();
    }
    case "wireSelected": {
      return wireText(scene, known, announcement);
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
