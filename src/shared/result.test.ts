import { expect, test } from "vitest";

import type { Result } from "./result";
import { err, isErr, isOk, mapResult, ok } from "./result";

test("ok/err narrow via isOk", () => {
  const result: Result<number, string> = ok(1);
  expect(isOk(result) && result.value).toBe(1);
  expect(isErr(err("x"))).toBe(true);
  expect(isErr(result)).toBe(false);
  expect(isOk(err("x"))).toBe(false);
});

test("mapResult maps ok and passes err through", () => {
  expect(mapResult(ok(2), (num) => num * 2)).toEqual({ ok: true, value: 4 });
  expect(mapResult(err("e"), (num: number) => num)).toEqual({ ok: false, error: "e" });
});
