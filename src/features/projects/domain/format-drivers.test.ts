/* oxlint-disable typescript/prefer-readonly-parameter-types -- projects carry branded ids (mutable object types); none is mutated */
import { describe, expect, test } from "vitest";

import { newWireId } from "~/shared/ids";

import { createDemoProject } from "./demo";
import { parseProjectFile, parseStoredProject, serializeProject } from "./format";
import type { Project } from "./model";

/** The demo with its first wire repeated, so one sink bit has two drivers. */
const withSecondDriver = (project: Project, alsoSaved: boolean): Project => {
  const [chip] = project.chips;
  const first = chip?.draft.wires[0];
  if (chip === undefined || first === undefined) {
    return project;
  }
  const draft = { ...chip.draft, wires: [...chip.draft.wires, { ...first, id: newWireId() }] };
  return { ...project, chips: [{ ...chip, draft, ...(alsoSaved ? { saved: draft } : {}) }] };
};

const textOf = (alsoSaved: boolean): string =>
  serializeProject(withSecondDriver(createDemoProject("x"), alsoSaved));

describe("parseProjectFile: duplicate drivers", () => {
  test("two wires into one input is InvalidProject and names the chip and circuit", () => {
    expect(parseProjectFile(textOf(false))).toEqual({
      ok: false,
      error: {
        type: "InvalidProject",
        issues: ["chips.0.draft.wires: input driven by more than one wire"],
      },
    });
  });

  test("a stored project and a saved version are checked the same way", () => {
    expect(parseStoredProject(textOf(true))).toEqual({
      ok: false,
      error: {
        type: "InvalidProject",
        issues: [
          "chips.0.draft.wires: input driven by more than one wire",
          "chips.0.saved.wires: input driven by more than one wire",
        ],
      },
    });
  });

  test("the unmodified demo still parses", () => {
    const text = serializeProject(createDemoProject("x"));
    expect(parseProjectFile(text).ok).toBe(true);
  });
});
