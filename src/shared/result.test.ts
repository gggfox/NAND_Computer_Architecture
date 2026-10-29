import { expect, test } from "vitest";
import { err, isErr, isOk, mapResult, ok, type Result } from "./result";

test("ok/err narrow via isOk", () => {
  const r: Result<number, string> = ok(1);
  expect(isOk(r) && r.value).toBe(1);
  expect(isErr(err("x"))).toBe(true);
  expect(isErr(r)).toBe(false);
  expect(isOk(err("x"))).toBe(false);
});

test("mapResult maps ok and passes err through", () => {
  expect(mapResult(ok(2), (n) => n * 2)).toEqual({ ok: true, value: 4 });
  expect(mapResult(err("e"), (n: number) => n)).toEqual({ ok: false, error: "e" });
});
