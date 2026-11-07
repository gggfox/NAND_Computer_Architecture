import { describe, expect, test } from "vitest";

import { copyProject } from "./copy";
import { createDemoProject } from "./demo";

describe("copyProject", () => {
  test("gives the copy a new id and the requested name", () => {
    const original = createDemoProject("Adder");
    const copy = copyProject(original, "Adder (copy)");
    expect(copy.ok).toBe(true);
    if (copy.ok) {
      expect(copy.value.id).not.toBe(original.id);
      expect(copy.value.name).toBe("Adder (copy)");
    }
  });

  test("keeps everything else", () => {
    const original = createDemoProject("Adder");
    const copy = copyProject(original, "Adder (copy)");
    expect(copy).toEqual({
      ok: true,
      value: { ...original, id: expect.any(String) as unknown, name: "Adder (copy)" },
    });
  });

  test("does not change the original", () => {
    const original = createDemoProject("Adder");
    const before = structuredClone(original);
    copyProject(original, "Adder (copy)");
    expect(original).toEqual(before);
  });

  test("a blank name is an error", () => {
    expect(copyProject(createDemoProject("Adder"), "   ")).toEqual({
      ok: false,
      error: { type: "EmptyName" },
    });
  });
});
