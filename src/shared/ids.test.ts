import { expect, test } from "vitest";

import { assertNever } from "./assert-never";
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
} from "./ids";
import type { ChipId } from "./ids";

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
  const chipId: ChipId = newPinId();
  expect(chipId).toBeTypeOf("string");
});

test("assertNever throws on unreachable values", () => {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- deliberately forging an impossible value to reach the throw
  expect(() => assertNever("boom" as never)).toThrow("Unexpected value");
});
