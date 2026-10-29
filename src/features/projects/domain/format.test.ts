import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";
import { z } from "zod";

import { createDemoProject } from "./demo";
import { importErrorMessage } from "./errors";
import type { ImportError } from "./errors";
import { MAX_IMPORT_BYTES, parseProjectFile, serializeProject } from "./format";
import type { Migration } from "./migrations";
import type { Project } from "./model";

const fixture = readFileSync(
  path.join(import.meta.dirname, "..", "fixtures", "v1-demo.json"),
  "utf-8",
);

const OldFileSchema = z.looseObject({
  project: z.looseObject({ title: z.string() }),
});

const envelope = (version: number, project: unknown = {}): string =>
  JSON.stringify({ format: "nand-project", version, project });

/* oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- branded ids are mutable object types; the value is never mutated */
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
  test("wire bitWidth 0", () => {
    const project = createDemoProject("x");
    const [first, ...rest] = project.rootCircuit.wires;
    const bad = {
      ...project,
      rootCircuit: { ...project.rootCircuit, wires: [{ ...first, bitWidth: 0 }, ...rest] },
    };
    const result = parseProjectFile(envelope(1, bad));
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

describe("parseProjectFile migrations", () => {
  test("a migration chain upgrades older files", () => {
    const project = createDemoProject("x");
    expect(parseProjectFile(oldFile(project), [renameTitle], 2)).toEqual({
      ok: true,
      value: project,
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
  test("an unknown case is rejected by assertNever", () => {
    /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Deliberately violates the exhaustive union to hit assertNever */
    const unknown = JSON.parse('{"type":"Bogus"}') as never;
    expect(() => importErrorMessage(unknown)).toThrow("Unexpected value");
  });
});
