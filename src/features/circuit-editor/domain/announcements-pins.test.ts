/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { afterEach, describe, expect, it } from "vitest";

import type { ConnectionError, PinRef } from "~/features/projects";
import { createDemoProject, EMPTY_CIRCUIT, piece } from "~/features/projects";
import type { Locale } from "~/i18n/paraglide/runtime";
import { overwriteGetLocale } from "~/i18n/paraglide/runtime";
import type { PinId } from "~/shared/ids";

import { announcementText } from "./announcements";
import { noticeText, pinAnnouncementText } from "./announcements-pins";
import type { Scene } from "./geometry";
import type { BulkWireError } from "./pin-selection";
import type { KnownLevels } from "./signals";

const known: KnownLevels = { inputs: new Map<PinId, number>(), outputs: new Map<PinId, number>() };

const FIRST_PIN = 0;
const MISSING_PIN = 99;

const demo = () => {
  const project = createDemoProject("x");
  const draft = project.chips[0]?.draft ?? EMPTY_CIRCUIT;
  const nand = piece({ type: "nand" }, { x: 480, y: 0 });
  const circuit = { ...draft, instances: [...draft.instances, nand] };
  const scene: Scene = { project, circuit };
  const at: PinRef = { instanceId: nand.id, pin: FIRST_PIN };
  return { scene, at };
};

const setLocale = (locale: Locale): void => {
  overwriteGetLocale(() => locale);
};

afterEach(() => {
  setLocale("en");
});

describe("pin selection and bulk wire announcements", () => {
  it("counts the selected pins, or says the selection is cleared", () => {
    const { scene } = demo();
    const say = (count: number) => announcementText(scene, known, { type: "pinsSelected", count });
    expect(say(3)).toBe("Pins selected: 3");
    expect(say(0)).toBe("Pin selection cleared");
    setLocale("es");
    expect(say(3)).toBe("Pines seleccionados: 3");
    expect(say(0)).toBe("Selección de pines borrada");
  });

  it("says a fan-out and a bit-by-bit wire, naming the pin", () => {
    const { scene, at } = demo();
    const fan = pinAnnouncementText(scene, known, { type: "bulkWired", count: 4, source: at });
    const bits = pinAnnouncementText(scene, known, {
      type: "bulkWired",
      count: 4,
      source: at,
      bits: { first: 0, last: 3 },
    });
    expect(fan).toMatch(/^Wired 4 pins to \S+$/u);
    expect(bits).toMatch(/^Wired 4 pins to bits 0–3 of \S+$/u);
    setLocale("es");
    const source = at;
    expect(pinAnnouncementText(scene, known, { type: "bulkWired", count: 4, source })).toMatch(
      /^4 pines cableados a \S+$/u,
    );
    expect(
      pinAnnouncementText(scene, known, {
        type: "bulkWired",
        count: 4,
        source,
        bits: { first: 0, last: 3 },
      }),
    ).toMatch(/^4 pines cableados a los bits 0–3 de \S+$/u);
  });
});

const BULK: readonly (readonly [BulkWireError, string, string])[] = [
  [
    { type: "SourceSelected" },
    "that pin is one of the selected pins",
    "ese pin es uno de los pines seleccionados",
  ],
  [
    { type: "MixedPins" },
    "the selected pins differ in width or direction",
    "los pines seleccionados difieren en ancho o dirección",
  ],
  [
    { type: "SameDirection" },
    "the selected pins face the same way as that pin",
    "los pines seleccionados tienen la misma dirección que ese pin",
  ],
  [{ type: "TooManyPins", pins: 5, bits: 4 }, "5 pins but only 4 bits", "5 pines pero solo 4 bits"],
  [
    { type: "InputTakesOneWire" },
    "an input takes only one wire",
    "una entrada admite un solo cable",
  ],
];

describe("refusals", () => {
  it.each(BULK)("words %j with the pin and chip named", (reason, en, es) => {
    const { scene, at } = demo();
    const say = () =>
      announcementText(scene, known, { type: "bulkRefused", refusal: { reason, at } });
    const name = /^(?<name>\S+) on NAND gate 2: /u.exec(say())?.groups?.["name"];
    expect(say()).toBe(`${name ?? ""} on NAND gate 2: ${en}`);
    setLocale("es");
    expect(say()).toBe(`${name ?? ""} en Puerta NAND 2: ${es}`);
  });

  it("words a refused plain connection the same way", () => {
    const { scene, at } = demo();
    const reason: ConnectionError = { type: "InputAlreadyDriven", instanceId: at.instanceId };
    const refusal = { reason, at };
    expect(noticeText(scene, known, refusal)).toMatch(
      /^\S+ on NAND gate 2: that input already has a wire$/u,
    );
    expect(announcementText(scene, known, { type: "bulkRefused", refusal })).toBe(
      noticeText(scene, known, refusal),
    );
    setLocale("es");
    expect(noticeText(scene, known, refusal)).toMatch(/^\S+ en Puerta NAND 2: /u);
  });

  it("shows a plain connection error as its message", () => {
    const { scene } = demo();
    expect(noticeText(scene, known, { type: "OutputToOutput" })).toBe(
      "Two outputs can't be wired together.",
    );
  });

  it("says nothing when the refused pin is gone", () => {
    const { scene, at } = demo();
    const refusal = { reason: { type: "MixedPins" } as const, at: { ...at, pin: MISSING_PIN } };
    expect(noticeText(scene, known, refusal)).toBe("");
    expect(
      announcementText(scene, known, { type: "bulkWired", count: 1, source: refusal.at }),
    ).toBe("");
  });
});
