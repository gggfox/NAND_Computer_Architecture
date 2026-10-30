import { describe, expect, test } from "vitest";

import { createDemoProject } from "./demo";
import { parseProjectFile, serializeProject } from "./format";

const withWireColor = (color: unknown): string => {
  const project = createDemoProject("x");
  const [chip, ...others] = project.chips;
  const [first, ...rest] = chip?.draft.wires ?? [];
  return JSON.stringify({
    format: "nand-project",
    version: 1,
    project: {
      ...project,
      chips: [
        { ...chip, draft: { ...chip?.draft, wires: [{ ...first, color }, ...rest] } },
        ...others,
      ],
    },
  });
};

describe("wire colour", () => {
  test("a version-1 file without wire colours parses", () => {
    const parsed = parseProjectFile(serializeProject(createDemoProject("x")));
    expect(parsed.ok && parsed.value.chips[0]?.draft.wires[0]?.color).toBeUndefined();
    expect(parsed.ok).toBe(true);
  });
  test("a wire colour round-trips through serialize and parse", () => {
    const parsed = parseProjectFile(withWireColor("teal"));
    expect(parsed.ok).toBe(true);
    const again = parsed.ok ? parseProjectFile(serializeProject(parsed.value)) : parsed;
    expect(again).toEqual(parsed);
    expect(again.ok && again.value.chips[0]?.draft.wires[0]?.color).toBe("teal");
  });
  test("an unknown wire colour is rejected", () => {
    const result = parseProjectFile(withWireColor("magenta"));
    expect(!result.ok && result.error.type).toBe("InvalidProject");
  });
});
