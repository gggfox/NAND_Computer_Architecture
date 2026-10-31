import { describe, expect, it } from "vitest";

import { glowsAt, previewToken, styleKey, WIRE_WIDTH, wireStyle } from "./wire-style";

describe("wireStyle", () => {
  it("keeps the signal colours on a default wire, dashed when low", () => {
    expect(wireStyle({ level: 1 })).toStrictEqual({
      token: "signal-high",
      dash: [],
      width: WIRE_WIDTH + 1,
      glow: true,
      rank: 2,
    });
    expect(wireStyle({ level: 0 })).toStrictEqual({
      token: "signal-low",
      dash: [6, 4],
      width: WIRE_WIDTH,
      glow: false,
      rank: 1,
    });
  });

  it("draws a coloured wire in full colour when high and muted, dashed, when low", () => {
    expect(wireStyle({ color: "teal", level: 1 })).toMatchObject({
      token: "wire-teal",
      dash: [],
      glow: true,
    });
    expect(wireStyle({ color: "teal", level: 0 })).toMatchObject({
      token: "wire-teal-muted",
      dash: [6, 4],
      glow: false,
    });
  });

  it("leaves an unknown level as the solid wire token, coloured or not", () => {
    const unknown = { token: "wire", dash: [], width: WIRE_WIDTH, glow: false, rank: 0 };
    expect(wireStyle({})).toStrictEqual(unknown);
    expect(wireStyle({ color: "red" })).toStrictEqual(unknown);
  });

  it("batches by stroke, dash and width", () => {
    expect(styleKey(wireStyle({ color: "red", level: 0 }))).toBe("wire-red-muted|6,4|3");
    expect(styleKey(wireStyle({ level: 1 }))).toBe("signal-high||4");
  });
});

describe("glowsAt", () => {
  it("skips the glow below zoom 0.5", () => {
    expect(glowsAt(0.49)).toBe(false);
    expect(glowsAt(0.5)).toBe(true);
  });
});

describe("previewToken", () => {
  it("previews in the armed colour, or the focus ring by default", () => {
    expect(previewToken("pink")).toBe("wire-pink");
    expect(previewToken()).toBe("focus-ring");
  });
});
