import { expect, test } from "vitest";
import {
  ChipIdSchema,
  InstanceIdSchema,
  PinIdSchema,
  ProjectIdSchema,
  WireIdSchema,
  newChipId,
  newInstanceId,
  newPinId,
  newProjectId,
  newWireId,
  type ChipId,
} from "./ids";
import { assertNever } from "./assert-never";

test("branded ids reject non-uuids and accept generated ids", () => {
  expect(ChipIdSchema.safeParse("nope").success).toBe(false);
  expect(ChipIdSchema.safeParse(newChipId()).success).toBe(true);
  expect(ProjectIdSchema.safeParse(newProjectId()).success).toBe(true);
  expect(InstanceIdSchema.safeParse(newInstanceId()).success).toBe(true);
  expect(PinIdSchema.safeParse(newPinId()).success).toBe(true);
  expect(WireIdSchema.safeParse(newWireId()).success).toBe(true);
});

test("ids of different kinds are not assignable (type-level)", () => {
  // @ts-expect-error PinId is not a ChipId
  const _c: ChipId = newPinId();
  expect(_c).toBeTypeOf("string");
});

test("assertNever throws on unreachable values", () => {
  expect(() => assertNever("boom" as never)).toThrow("Unexpected value");
});
