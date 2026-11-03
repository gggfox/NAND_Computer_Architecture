import { describe, expect, it } from "vitest";

import { announcementText } from "./announcements";
import { isListAnnouncement, suggestAnnouncementText } from "./announcements-suggest";
import { suggested } from "./interaction-suggest.fixtures";

const known = { inputs: new Map(), outputs: new Map() };

describe("suggestion announcement text", () => {
  it("is routed from announcementText and empty until the messages exist", () => {
    const { scene } = suggested();
    const announcement = { type: "dismissed" } as const;
    expect(suggestAnnouncementText(scene, known, announcement)).toBe("");
    expect(announcementText(scene, known, announcement)).toBe("");
  });

  it("still words the pin announcements, and leaves the rest alone", () => {
    const { scene } = suggested();
    expect(announcementText(scene, known, { type: "pinsSelected", count: 2 })).not.toBe("");
    expect(isListAnnouncement({ type: "cleared" })).toBe(false);
  });
});
