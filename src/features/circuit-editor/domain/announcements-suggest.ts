import { pinAnnouncementText } from "./announcements-pins";
import type { Scene } from "./geometry";
import type { Announcement } from "./interaction";
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

/** The live region's words for the suggestion announcements; the texts come with the messages. */
export const suggestAnnouncementText = (
  _scene: Scene,
  _known: KnownLevels,
  _announcement: SuggestAnnouncement,
): string => "";

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
