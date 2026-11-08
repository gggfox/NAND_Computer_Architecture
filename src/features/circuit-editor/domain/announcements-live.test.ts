/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { afterEach, describe, expect, it } from "vitest";

import type { PinRef } from "~/features/projects";
import { createDemoProject, EMPTY_CIRCUIT, piece } from "~/features/projects";
import type { Locale } from "~/i18n/paraglide/runtime";
import { overwriteGetLocale } from "~/i18n/paraglide/runtime";
import type { PinId } from "~/shared/ids";

import { announcementText } from "./announcements";
import type { Scene } from "./geometry";
import type { KnownLevels } from "./signals";

const known: KnownLevels = { inputs: new Map<PinId, number>(), outputs: new Map<PinId, number>() };

const MISSING_PIN = 99;

const demo = () => {
  const project = createDemoProject("x");
  const draft = project.chips[0]?.draft ?? EMPTY_CIRCUIT;
  const nand = piece({ type: "nand" }, { x: 480, y: 0 });
  const scene: Scene = { project, circuit: { ...draft, instances: [...draft.instances, nand] } };
  const from: PinRef = { instanceId: nand.id, pin: 0 };
  const to: PinRef = { instanceId: nand.id, pin: 1 };
  return { scene, from, to };
};

const setLocale = (locale: Locale): void => {
  overwriteGetLocale(() => locale);
};

afterEach(() => {
  setLocale("en");
});

describe("live region texts", () => {
  it("names both pins of a new wire, in English and Spanish", () => {
    const { scene, from, to } = demo();
    const announcement = { type: "wired", from, to } as const;
    expect(announcementText(scene, known, announcement)).toMatch(/^Wire added: .+ of .+ to .+$/u);
    setLocale("es");
    expect(announcementText(scene, known, announcement)).toMatch(/^Cable añadido: .+ a .+$/u);
  });

  it("keeps the short text when a pin of the new wire is gone", () => {
    const { scene, from } = demo();
    const gone = { ...from, pin: MISSING_PIN };
    expect(announcementText(scene, known, { type: "wired", from, to: gone })).toBe("Wire added");
  });

  it("says every output in one line, in English and Spanish", () => {
    const { scene } = demo();
    const readings = [
      { name: "SUM", value: 1 },
      { name: "CARRY", value: 0 },
      { name: "X", value: undefined },
    ];
    const say = (items: typeof readings) =>
      announcementText(scene, known, { type: "outputs", readings: items });
    expect(say(readings)).toBe("Outputs: SUM 1, CARRY 0, X unknown");
    expect(say([])).toBe("No outputs.");
    setLocale("es");
    expect(say(readings)).toBe("Salidas: SUM 1, CARRY 0, X desconocida");
    expect(say([])).toBe("No hay salidas.");
  });
});
