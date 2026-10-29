import { describe, expect, test } from "vitest";

import { defaultChain, migrateToCurrent } from "./migrations";
import type { Migration } from "./migrations";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const addField =
  (key: string): Migration["migrate"] =>
  (data) => ({ ...(isRecord(data) ? data : {}), [key]: true });

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
      value: { version: 1, first: true, second: true },
    });
  });
  test("a gap is UnsupportedVersion", () => {
    const chain = [{ from: 2, migrate: addField("late") }];
    expect(migrateToCurrent({ version: 1 }, chain, 3)).toEqual({
      ok: false,
      error: { type: "UnsupportedVersion", version: 1 },
    });
  });
});
