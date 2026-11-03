import { m } from "~/i18n/paraglide/messages";
import { assertNever } from "~/shared/assert-never";

import { isListAnnouncement, listAnnouncementText } from "./announcements-suggest";
import type { ListAnnouncement } from "./announcements-suggest";
import { chipLabel } from "./chip-label";
import { editorErrorMessage } from "./editor-error-messages";
import type { Scene } from "./geometry";
import type { Announcement } from "./interaction";
import { partName } from "./messages";
import { pinInfo } from "./pin-info";
import type { KnownLevels } from "./signals";

export { chipLabel } from "./chip-label";

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

type WireEnd = Scene["circuit"]["wires"][number]["from"];

/** A wire end as "{pin} of {chip}", or `undefined` when the pin is gone. */
const endText = (scene: Scene, known: KnownLevels, end: WireEnd): string | undefined => {
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

type PlacementAnnouncement = Extract<Announcement, { type: "placing" | "placed" }>;

const isPlacement = (announcement: Announcement): announcement is PlacementAnnouncement =>
  announcement.type === "placing" || announcement.type === "placed";

/** Placement armed, stopped, or a part placed, named as the library names it. */
const placementText = (scene: Scene, announcement: PlacementAnnouncement): string => {
  const { kind } = announcement;
  if (kind === undefined) {
    return m.announce_placing_stopped();
  }
  const name = partName(scene.project, scene.circuit, kind);
  return announcement.type === "placing"
    ? m.announce_placing({ name })
    : m.announce_placed({ name });
};

/** The live region's words for an announcement (ADR 3, 17). */
export const announcementText = (
  scene: Scene,
  known: KnownLevels,
  announcement: Announcement,
): string => {
  if (isListAnnouncement(announcement)) {
    return listAnnouncementText(scene, known, announcement);
  }
  if (isWiring(announcement)) {
    return wiringText(scene, known, announcement);
  }
  return isPlacement(announcement)
    ? placementText(scene, announcement)
    : plainText(scene, known, announcement);
};

/** A pin of the open chip added from the quick-add menu. */
const pinAddedText = ({ direction, name }: Extract<Announcement, { type: "pinAdded" }>): string =>
  direction === "input" ? m.announce_input_added({ name }) : m.announce_output_added({ name });

/** Parts copied, cut, pasted, duplicated or added in an array. */
const CLIPBOARD_TEXT: Readonly<
  Record<Extract<Announcement, { type: "clipboard" }>["did"], (input: { count: number }) => string>
> = {
  copy: m.canvas_copied,
  cut: m.canvas_cut,
  paste: m.canvas_pasted,
  duplicate: m.canvas_duplicated,
  array: m.canvas_arrayed,
};

/** The selection, move, delete, tool and pin announcements. */
const plainText = (
  scene: Scene,
  known: KnownLevels,
  announcement: Exclude<
    Announcement,
    WiringAnnouncement | PlacementAnnouncement | ListAnnouncement
  >,
): string => {
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
    case "clipboard": {
      return CLIPBOARD_TEXT[announcement.did]({ count: announcement.count });
    }
    case "tool": {
      return announcement.tool === "pan" ? m.canvas_tool_pan() : m.canvas_tool_select();
    }
    case "pin": {
      return pinText(scene, known, announcement);
    }
    case "pinAdded": {
      return pinAddedText(announcement);
    }
    default: {
      return assertNever(announcement);
    }
  }
};
