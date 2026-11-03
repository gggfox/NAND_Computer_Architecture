import { m } from "~/i18n/paraglide/messages";

import { chipLabel } from "./chip-label";
import { editorErrorMessage, refusalReasonMessage } from "./editor-error-messages";
import type { Scene } from "./geometry";
import { pinInfo } from "./pin-info";
import type { BulkRefusal, Notice, PinAnnouncement } from "./pin-selection";
import type { KnownLevels } from "./signals";

/** "{pin} on {chip}: {reason}", or nothing when the pin is gone (D11). */
const refusalText = (scene: Scene, known: KnownLevels, { reason, at }: BulkRefusal): string => {
  const info = pinInfo(scene, known, [at.instanceId, at.pin]);
  return info === undefined
    ? ""
    : m.canvas_bulk_refused({
        pin: info.name,
        chip: chipLabel(scene, at.instanceId),
        reason: refusalReasonMessage(reason),
      });
};

const wiredText = (
  scene: Scene,
  known: KnownLevels,
  announcement: Extract<PinAnnouncement, { type: "bulkWired" }>,
): string => {
  const { count, source, bits } = announcement;
  const info = pinInfo(scene, known, [source.instanceId, source.pin]);
  if (info === undefined) {
    return "";
  }
  return bits === undefined
    ? m.canvas_bulk_wired({ count, pin: info.name })
    : m.canvas_bulk_wired_bits({ count, first: bits.first, last: bits.last, pin: info.name });
};

/** The live region's words for the pin selection and a bulk wire (D11). */
export const pinAnnouncementText = (
  scene: Scene,
  known: KnownLevels,
  announcement: PinAnnouncement,
): string => {
  if (announcement.type === "pinsSelected") {
    return announcement.count === 0
      ? m.canvas_pins_cleared()
      : m.canvas_pins_selected({ count: announcement.count });
  }
  return announcement.type === "bulkWired"
    ? wiredText(scene, known, announcement)
    : refusalText(scene, known, announcement.refusal);
};

/** The canvas notice's words: a bulk refusal as the announcement says it, else the error's. */
export const noticeText = (scene: Scene, known: KnownLevels, notice: Notice): string =>
  "reason" in notice ? refusalText(scene, known, notice) : editorErrorMessage(notice);
