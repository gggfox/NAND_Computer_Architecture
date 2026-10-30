import { describe, expect, test } from "vitest";

import { WIRE_COLORS } from "~/features/projects";
import { contrastRatio } from "~/shared/contrast";

import { themeIds, themes } from "./themes";
import type { ThemeId } from "./themes";

const MIN_UI = 3;
const KEYS: readonly string[] = WIRE_COLORS;

const capitalised = (key: string): string => `${key.charAt(0).toUpperCase()}${key.slice(1)}`;

const tokenMap = (id: ThemeId): Map<string, string> =>
  new Map(
    Object.entries(themes[id]).map((entry: readonly [string, string]): [string, string] => [
      entry[0],
      entry[1],
    ]),
  );

describe("wire colour tokens", () => {
  test("every wire colour and its muted form reach 3:1 against the background in every theme", () => {
    for (const id of themeIds) {
      const tokens = tokenMap(id);
      const background = tokens.get("colorBackground") ?? "";
      for (const key of KEYS) {
        const on = tokens.get(`colorWire${capitalised(key)}`) ?? "";
        const muted = tokens.get(`colorWire${capitalised(key)}Muted`) ?? "";
        expect(contrastRatio(on, background), `${id} ${key}`).toBeGreaterThanOrEqual(MIN_UI);
        expect(contrastRatio(muted, background), `${id} ${key} muted`).toBeGreaterThanOrEqual(
          MIN_UI,
        );
      }
    }
  });

  test("muted sits closer to the background than on in every theme", () => {
    for (const id of themeIds) {
      const tokens = tokenMap(id);
      const background = tokens.get("colorBackground") ?? "";
      for (const key of KEYS) {
        const on = tokens.get(`colorWire${capitalised(key)}`) ?? "";
        const muted = tokens.get(`colorWire${capitalised(key)}Muted`) ?? "";
        expect(contrastRatio(muted, background), `${id} ${key}`).toBeLessThan(
          contrastRatio(on, background),
        );
      }
    }
  });
});
