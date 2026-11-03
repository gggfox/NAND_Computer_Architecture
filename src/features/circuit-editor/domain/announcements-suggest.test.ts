import { afterEach, assert, describe, expect, it } from "vitest";

import type { Locale } from "~/i18n/paraglide/runtime";
import { overwriteGetLocale } from "~/i18n/paraglide/runtime";
import { newInstanceId } from "~/shared/ids";

import { announcementText } from "./announcements";
import { isListAnnouncement, suggestAnnouncementText } from "./announcements-suggest";
import { suggested } from "./interaction-suggest.fixtures";
import type { Ghost } from "./selection";

const known = { inputs: new Map(), outputs: new Map() };

const setLocale = (locale: Locale): void => {
  overwriteGetLocale(() => locale);
};

afterEach(() => {
  setLocale("en");
});

/** The ghost from bit 2 of the 4-bit input `d` into a `Reg`. */
const busGhost = (ghosts: readonly Ghost[]): Ghost => {
  const ghost = ghosts.find((item) => item.from.bit === 2);
  assert(ghost !== undefined);
  return ghost;
};

describe("suggestion announcement text", () => {
  it("counts the suggested wires, or says there are none", () => {
    const { scene } = suggested();
    const say = (count: number) => announcementText(scene, known, { type: "suggested", count });
    expect(say(20)).toBe("Wires suggested: 20");
    expect(say(0)).toBe("No wires to suggest");
    setLocale("es");
    expect(say(20)).toBe("Cables sugeridos: 20");
    expect(say(0)).toBe("No hay cables que sugerir");
  });

  it("says accepted and dismissed", () => {
    const { scene } = suggested();
    const accepted = { type: "accepted", count: 3 } as const;
    const dismissed = { type: "dismissed" } as const;
    expect(suggestAnnouncementText(scene, known, accepted)).toBe("Wires accepted: 3");
    expect(suggestAnnouncementText(scene, known, dismissed)).toBe("Suggestions dismissed");
    setLocale("es");
    expect(announcementText(scene, known, accepted)).toBe("Cables aceptados: 3");
    expect(announcementText(scene, known, dismissed)).toBe("Sugerencias descartadas");
  });

  it("names both ends of the focused ghost, a bus bit as d.2, counting from 1", () => {
    const { scene, ghosts } = suggested();
    const ghost = busGhost(ghosts);
    const focused = { type: "ghostFocused", index: 4, count: 20, ghost } as const;
    const en = announcementText(scene, known, focused);
    expect(en).toMatch(/^Suggested wire 5 of 20: d\.2 on d to d\d on .+$/u);
    setLocale("es");
    expect(announcementText(scene, known, focused)).toMatch(
      /^Cable sugerido 5 de 20: d\.2 en d a d\d en .+$/u,
    );
  });
});

describe("suggestion announcements with a pin gone", () => {
  it("says nothing when an end is gone", () => {
    const { scene, ghosts } = suggested();
    const [first] = ghosts;
    assert(first !== undefined);
    const gone = { ...first.to, instanceId: newInstanceId() };
    const lostTo = { ...first, to: gone };
    const lostFrom = { ...first, from: gone };
    for (const ghost of [lostTo, lostFrom]) {
      expect(
        suggestAnnouncementText(scene, known, { type: "ghostFocused", index: 0, count: 1, ghost }),
      ).toBe("");
    }
  });
});

describe("list announcements", () => {
  it("still words the pin announcements, and leaves the rest alone", () => {
    const { scene } = suggested();
    expect(announcementText(scene, known, { type: "pinsSelected", count: 2 })).not.toBe("");
    expect(isListAnnouncement({ type: "cleared" })).toBe(false);
    expect(isListAnnouncement({ type: "dismissed" })).toBe(true);
  });
});
