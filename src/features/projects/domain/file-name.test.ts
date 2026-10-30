import { describe, expect, test } from "vitest";

import { MAX_FILE_NAME_LENGTH, projectFileName } from "./file-name";

describe("projectFileName", () => {
  test("keeps an ordinary name", () => {
    expect(projectFileName("NAND demo")).toBe("NAND demo.nand.json");
  });

  test("replaces path separators, reserved and control characters", () => {
    expect(projectFileName('../a/b\\c:d*e?f"g<h>i|j\u0000k')).toBe(
      "a-b-c-d-e-f-g-h-i-j-k.nand.json",
    );
  });

  test("falls back when nothing usable is left", () => {
    expect(projectFileName("  ...  ")).toBe("project.nand.json");
    expect(projectFileName("")).toBe("project.nand.json");
  });

  test("caps the length", () => {
    const name = projectFileName("x".repeat(MAX_FILE_NAME_LENGTH * 2));
    expect(name).toBe(`${"x".repeat(MAX_FILE_NAME_LENGTH)}.nand.json`);
  });
});
