import { describe, expect, test } from "vitest";

import { defaultChain, migrateToCurrent } from "./migrations";
import type { Migration } from "./migrations";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const addField =
  (key: string): Migration["migrate"] =>
  (data) => {
    const record = isRecord(data) ? data : {};
    const version = typeof record["version"] === "number" ? record["version"] : 0;
    return { ...record, version: version + 1, [key]: true };
  };

describe("migrateToCurrent", () => {
  test("default chain is empty", () => {
    expect(defaultChain).toEqual([]);
  });
  test("already current needs no migration", () => {
    expect(migrateToCurrent({ version: 1 }, [], 1)).toEqual({ ok: true, value: { version: 1 } });
  });
  test("applies steps in order", () => {
    const chain = [
      { from: 1, migrate: addField("first") },
      { from: 2, migrate: addField("second") },
    ];
    expect(migrateToCurrent({ version: 1 }, chain, 3)).toEqual({
      ok: true,
      value: { version: 3, first: true, second: true },
    });
  });
  test("a gap is UnsupportedVersion", () => {
    const chain = [{ from: 2, migrate: addField("late") }];
    expect(migrateToCurrent({ version: 1 }, chain, 3)).toEqual({
      ok: false,
      error: { type: "UnsupportedVersion", version: 1 },
    });
  });
  test("a step that keeps the version is an error", () => {
    const chain = [{ from: 1, migrate: (data: unknown) => data }];
    expect(migrateToCurrent({ version: 1 }, chain, 2)).toEqual({
      ok: false,
      error: {
        type: "InvalidProject",
        issues: ["migration did not produce version 2"],
      },
    });
  });
  test("a step that skips a version is an error", () => {
    const chain = [{ from: 1, migrate: () => ({ version: 3 }) }];
    expect(migrateToCurrent({ version: 1 }, chain, 3).ok).toBe(false);
  });
  test("a step that returns a non-object is an error", () => {
    const chain = [{ from: 1, migrate: () => "nope" }];
    expect(migrateToCurrent({ version: 1 }, chain, 2).ok).toBe(false);
  });
});
