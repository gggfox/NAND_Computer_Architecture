/* oxlint-disable typescript/prefer-readonly-parameter-types -- projects carry branded ids (mutable object types); none is mutated */
/* oxlint-disable import/max-dependencies -- one test file covers the whole format module, plus the locale switch */
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";
import { z } from "zod";

import { overwriteGetLocale } from "~/i18n/paraglide/runtime";
import { newChipId, newInstanceId } from "~/shared/ids";

import { createDemoProject } from "./demo";
import { importErrorMessage } from "./errors";
import type { ImportError } from "./errors";
import {
  MAX_IMPORT_BYTES,
  parseProjectFile,
  parseStoredProject,
  serializeProject,
  serializeStoredProject,
} from "./format";
import type { Migration } from "./migrations";
import { isHexColor } from "./model";
import type { Chip, Project } from "./model";

const fixture = readFileSync(
  path.join(import.meta.dirname, "..", "fixtures", "v1-demo.json"),
  "utf-8",
);

const OldFileSchema = z.looseObject({
  project: z.looseObject({ title: z.string() }),
});

const envelope = (version: number, project: unknown = {}): string =>
  JSON.stringify({ format: "nand-project", version, project });

const oldFile = (project: Project): string => {
  const { name, ...rest } = project;
  return JSON.stringify({ format: "nand-project", version: 1, project: { ...rest, title: name } });
};

const identity = (data: unknown): unknown => data;

const renameTitle: Migration = {
  from: 1,
  migrate: (data) => {
    const parsed = OldFileSchema.parse(data);
    const { title, ...others } = parsed.project;
    return { ...parsed, version: 2, project: { ...others, name: title } };
  },
};

type Corrupt = (project: Project) => unknown;

/** Rewrites the demo's only chip; the result is deliberately loose JSON for the parser to reject. */
const withDemoChip =
  (patch: (chip: Chip) => unknown): Corrupt =>
  (project) => ({ ...project, chips: project.chips.map(patch) });

const withDraft = (patch: (draft: Chip["draft"]) => unknown): Corrupt =>
  withDemoChip((chip) => ({ ...chip, draft: patch(chip.draft) }));

const dropFirstPinDef: Corrupt = withDraft((draft) => ({ ...draft, pins: draft.pins.slice(1) }));

const duplicateFirstPinPiece: Corrupt = withDraft((draft) => ({
  ...draft,
  instances: [...draft.instances, { ...draft.instances[0], id: newInstanceId() }],
}));

const withFirstInstanceKind = (kind: unknown): Corrupt =>
  withDraft((draft) => ({
    ...draft,
    instances: draft.instances.map((item, index) => (index === 0 ? { ...item, kind } : item)),
  }));

const withFirstWire = (patch: (wire: Chip["draft"]["wires"][number]) => unknown): Corrupt =>
  withDraft((draft) => ({
    ...draft,
    wires: draft.wires.map((item, index) => (index === 0 ? patch(item) : item)),
  }));

const withFirstWireFromBit = (bit: number): Corrupt =>
  withFirstWire((item) => ({ ...item, from: { ...item.from, bit } }));

const withFirstWireWidth = (bitWidth: number): Corrupt =>
  withFirstWire((item) => ({ ...item, bitWidth }));

const withChipColor = (color: string): Corrupt => withDemoChip((chip) => ({ ...chip, color }));

const corruptions: readonly (readonly [string, Corrupt])[] = [
  ["lastOpenedChipId names no chip", (project) => ({ ...project, lastOpenedChipId: newChipId() })],
  ["no chips", (project) => ({ ...project, chips: [] })],
  ["a pin piece without a definition", dropFirstPinDef],
  ["a pin definition with two pieces", duplicateFirstPinPiece],
  ["split width 2", withFirstInstanceKind({ type: "split", width: 2 })],
  ["a bit index of 16", withFirstWireFromBit(16)],
  ["wire bitWidth 3", withFirstWireWidth(3)],
  ["color 'red'", withChipColor("red")],
  [
    "two chips with one id",
    (project) => ({ ...project, chips: [...project.chips, ...project.chips] }),
  ],
];

describe("parseProjectFile", () => {
  test("round-trips the demo project", () => {
    const project = createDemoProject("x");
    expect(parseProjectFile(serializeProject(project))).toEqual({ ok: true, value: project });
  });
  test("the committed v1 fixture parses", () => {
    expect(parseProjectFile(fixture).ok).toBe(true);
  });
  test("the fixture is the serialization of a parsed demo", () => {
    const parsed = parseProjectFile(fixture);
    expect(parsed.ok && serializeProject(parsed.value)).toBe(fixture.trimEnd());
  });
  test("broken JSON", () => {
    expect(parseProjectFile("{")).toEqual({ ok: false, error: { type: "InvalidJson" } });
  });
  test("wrong shape", () => {
    expect(parseProjectFile('{"foo":1}')).toEqual({
      ok: false,
      error: { type: "NotAProjectFile" },
    });
  });
  test("version 0", () => {
    expect(parseProjectFile(envelope(0))).toEqual({
      ok: false,
      error: { type: "UnsupportedVersion", version: 0 },
    });
  });
  test("version 2", () => {
    expect(parseProjectFile(envelope(2))).toEqual({
      ok: false,
      error: { type: "FutureVersion", version: 2, supported: 1 },
    });
  });
});

describe("project shape", () => {
  test("the demo is one draft-only chip the project opens on", () => {
    const project = createDemoProject("Demo");
    const [chip] = project.chips;
    expect(project.chips).toHaveLength(1);
    expect(chip?.saved).toBeUndefined();
    expect(project.lastOpenedChipId).toBe(chip?.id);
    expect(chip?.draft.pins.map((pin) => [pin.name, pin.direction, pin.width])).toEqual([
      ["A", "input", 1],
      ["B", "input", 1],
      ["OUT", "output", 1],
    ]);
    expect(chip?.draft.instances.map((item) => item.kind.type)).toEqual([
      "pin",
      "pin",
      "nand",
      "pin",
    ]);
    expect(chip?.draft.wires.every((item) => !item.manualWaypoints)).toBe(true);
  });
  test("isHexColor accepts #rrggbb only", () => {
    expect(["#3b82f6", "#ABCDEF", "red", "#fff"].map((color) => isHexColor(color))).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
  test.each(corruptions)("%s is InvalidProject", (_name, corrupt) => {
    const corrupted = corrupt(createDemoProject("x"));
    const result = parseProjectFile(envelope(1, corrupted));
    expect(!result.ok && result.error.type).toBe("InvalidProject");
  });
});

describe("parseProjectFile limits", () => {
  test("too large is rejected before JSON.parse", () => {
    expect(parseProjectFile("x".repeat(MAX_IMPORT_BYTES + 1))).toEqual({
      ok: false,
      error: { type: "TooLarge", bytes: MAX_IMPORT_BYTES + 1 },
    });
  });
  test("size counts bytes, not characters", () => {
    const result = parseProjectFile("é".repeat(MAX_IMPORT_BYTES / 2 + 1));
    expect(!result.ok && result.error.type).toBe("TooLarge");
  });
});

describe("stored projects", () => {
  test("a record larger than the import cap still parses: our own saves are trusted", () => {
    const project = createDemoProject("x".repeat(MAX_IMPORT_BYTES));
    const text = serializeStoredProject(project);
    expect(new TextEncoder().encode(text).byteLength).toBeGreaterThan(MAX_IMPORT_BYTES);
    expect(parseProjectFile(text).ok).toBe(false);
    expect(parseStoredProject(text)).toEqual({ ok: true, value: project });
  });

  test("stored records are compact and parse back like an export", () => {
    const project = createDemoProject("Compact");
    const stored = serializeStoredProject(project);
    expect(stored.length).toBeLessThan(serializeProject(project).length);
    expect(stored).not.toContain("\n");
    expect(parseStoredProject(stored)).toEqual(parseProjectFile(serializeProject(project)));
  });

  test("stored records are still validated", () => {
    expect(parseStoredProject("{")).toEqual({ ok: false, error: { type: "InvalidJson" } });
  });
});

describe("parseProjectFile migrations", () => {
  test("a migration chain upgrades older files", () => {
    const project = createDemoProject("x");
    expect(parseProjectFile(oldFile(project), [renameTitle], 2)).toEqual({
      ok: true,
      value: project,
    });
  });
  test("a migration that forgets to bump the version is rejected", () => {
    const project = createDemoProject("x");
    const stale: Migration = { from: 1, migrate: identity };
    expect(parseProjectFile(oldFile(project), [stale], 2)).toEqual({
      ok: false,
      error: { type: "InvalidProject", issues: ["migration did not produce version 2"] },
    });
  });
  test("a migration returning a non-object is rejected", () => {
    expect(parseProjectFile(envelope(1), [{ from: 1, migrate: () => 7 }], 2)).toEqual({
      ok: false,
      error: { type: "InvalidProject", issues: ["migration did not produce version 2"] },
    });
  });
  test("a throwing migration becomes a typed error", () => {
    const boom: Migration = {
      from: 1,
      migrate: (): unknown => structuredClone(Symbol("boom")),
    };
    expect(parseProjectFile(envelope(1), [boom], 2)).toEqual({
      ok: false,
      error: { type: "InvalidProject", issues: ["migration from version 1 failed"] },
    });
  });
  test("a chain with a gap is UnsupportedVersion", () => {
    expect(parseProjectFile(envelope(1), [{ from: 5, migrate: identity }], 2)).toEqual({
      ok: false,
      error: { type: "UnsupportedVersion", version: 1 },
    });
  });
});

describe("importErrorMessage", () => {
  const cases: ImportError[] = [
    { type: "TooLarge", bytes: 5_000_001 },
    { type: "InvalidJson" },
    { type: "NotAProjectFile" },
    { type: "UnsupportedVersion", version: 0 },
    { type: "FutureVersion", version: 2, supported: 1 },
    { type: "InvalidProject", issues: [] },
  ];
  test("every case has a non-empty message", () => {
    expect(cases.map((importError) => importErrorMessage(importError).length > 0)).toEqual(
      cases.map(() => true),
    );
  });
  describe("in Spanish", () => {
    afterEach(() => {
      overwriteGetLocale(() => "en");
    });
    test("every case has its own Spanish message", () => {
      overwriteGetLocale(() => "es");
      expect(cases.map((importError) => importErrorMessage(importError))).toEqual([
        "El archivo es demasiado grande para importar (máximo 5 MB).",
        "El archivo no es un JSON válido.",
        "El archivo no es un proyecto NAND.",
        expect.stringContaining("La versión 0 del archivo de proyecto"),
        expect.stringContaining("(versión del archivo 2, compatible 1)"),
        "El archivo de proyecto está dañado o no es válido.",
      ]);
    });
  });
  test("an unknown case is rejected by assertNever", () => {
    /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Deliberately violates the exhaustive union to hit assertNever */
    const unknown = JSON.parse('{"type":"Bogus"}') as never;
    expect(() => importErrorMessage(unknown)).toThrow("Unexpected value");
  });
});
