import type { PinRef } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";

import { pinAnnouncementText } from "./announcements-pins";
import { chipLabel } from "./chip-label";
import type { Scene } from "./geometry";
import type { Announcement } from "./interaction";
import { pinInfo } from "./pin-info";
import type { PinAnnouncement, SuggestAnnouncement } from "./selection";
import type { KnownLevels } from "./signals";

/** The announcements `announcements.ts` hands over: the pin list's and the suggested wires'. */
export type ListAnnouncement = PinAnnouncement | SuggestAnnouncement;

const LIST_TYPES: ReadonlySet<Announcement["type"]> = new Set([
  "pinsSelected",
  "bulkWired",
  "bulkRefused",
  "suggested",
  "accepted",
  "dismissed",
  "ghostFocused",
]);

export const isListAnnouncement = (announcement: Announcement): announcement is ListAnnouncement =>
  LIST_TYPES.has(announcement.type);

/** The `[4]` a bus pin's name carries; a bit tap is `d.2`, not `d[4].2`. */
const WIDTH_SUFFIX = /\[\d+\]$/u;

/** A ghost's end as spoken: the pin's name, `.k` for a bit tap; `undefined` when the pin is gone. */
const endName = (scene: Scene, known: KnownLevels, end: PinRef): string | undefined => {
  const info = pinInfo(scene, known, [end.instanceId, end.pin]);
  if (info === undefined) {
    return undefined;
  }
  return end.bit === undefined
    ? info.name
    : `${info.name.replace(WIDTH_SUFFIX, "")}.${String(end.bit)}`;
};

const focusedText = (
  scene: Scene,
  known: KnownLevels,
  { index, count, ghost }: Extract<SuggestAnnouncement, { type: "ghostFocused" }>,
): string => {
  const from = endName(scene, known, ghost.from);
  const to = endName(scene, known, ghost.to);
  return from === undefined || to === undefined
    ? ""
    : m.canvas_ghost_focused({
        index: index + 1,
        count,
        from,
        fromChip: chipLabel(scene, ghost.from.instanceId),
        to,
        toChip: chipLabel(scene, ghost.to.instanceId),
      });
};

/** The live region's words for the suggested wires (D16). */
export const suggestAnnouncementText = (
  scene: Scene,
  known: KnownLevels,
  announcement: SuggestAnnouncement,
): string => {
  if (announcement.type === "suggested") {
    return announcement.count > 0
      ? m.canvas_suggested({ count: announcement.count })
      : m.canvas_suggested_none();
  }
  if (announcement.type === "accepted") {
    return m.canvas_suggest_accepted({ count: announcement.count });
  }
  return announcement.type === "dismissed"
    ? m.canvas_suggest_dismissed()
    : focusedText(scene, known, announcement);
};

/** The words for a pin-list or suggestion announcement. */
export const listAnnouncementText = (
  scene: Scene,
  known: KnownLevels,
  announcement: ListAnnouncement,
): string =>
  announcement.type === "pinsSelected" ||
  announcement.type === "bulkWired" ||
  announcement.type === "bulkRefused"
    ? pinAnnouncementText(scene, known, announcement)
    : suggestAnnouncementText(scene, known, announcement);
