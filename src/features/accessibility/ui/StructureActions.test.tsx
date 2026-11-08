import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { openCircuit } from "~/features/circuit-editor";
import type { EditorSession } from "~/features/circuit-editor";
import { createDemoProject } from "~/features/projects";

import { addPartEntries, runAddPart } from "./AddPartMenu";
import { StructureSessionContext } from "./structure-session";
import { createTestSession } from "./structure-session.fixtures";
import { StructureActions } from "./StructureActions";

const setup = (): EditorSession => {
  const session = createTestSession();
  session.interaction.connect();
  return session;
};

const instancesOf = (session: EditorSession) => openCircuit(session.editor.getState()).instances;

const selectedOf = (session: EditorSession) =>
  session.interaction.store.getState().selection.instances;

describe("addPartEntries", () => {
  it("lists the built-in parts and no custom chip", () => {
    const entries = addPartEntries(createDemoProject("demo"));
    expect(entries.map((entry) => entry.id)).toEqual([
      "nand",
      "input",
      "output",
      "split-4",
      "merge-4",
      "split-8",
      "merge-8",
      "split-16",
      "merge-16",
      "clock",
    ]);
    expect(entries.map((entry) => entry.label)).toEqual(
      expect.arrayContaining(["NAND", "Input pin", "Output pin", "Split 4", "Merge 16", "Clock"]),
    );
  });
});

describe("runAddPart", () => {
  it("places one NAND, selects it and announces it", () => {
    const session = setup();
    const before = instancesOf(session).length;
    runAddPart(session, "nand");
    const after = instancesOf(session);
    expect(after).toHaveLength(before + 1);
    const added = after.at(-1);
    expect(added?.kind.type).toBe("nand");
    expect([...selectedOf(session)]).toEqual([added?.id]);
    expect(session.interaction.store.getState().announcement?.announcement.type).toBe("selected");
  });

  it.each(["split-8", "merge-4", "clock"])("places %s as one part", (id) => {
    const session = setup();
    const before = instancesOf(session).length;
    runAddPart(session, id);
    expect(instancesOf(session)).toHaveLength(before + 1);
    expect(selectedOf(session).size).toBe(1);
  });

  it.each([
    ["input", "input"],
    ["output", "output"],
  ] as const)("adds one %s pin and selects its piece", (id, direction) => {
    const session = setup();
    const known = new Set(openCircuit(session.editor.getState()).pins.map((pin) => pin.id));
    runAddPart(session, id);
    const added = openCircuit(session.editor.getState()).pins.filter((pin) => !known.has(pin.id));
    expect(added.map((pin) => pin.direction)).toEqual([direction]);
    expect(selectedOf(session).size).toBe(1);
  });

  it("is one undo step", () => {
    const session = setup();
    const before = instancesOf(session).length;
    runAddPart(session, "nand");
    session.editor.getState().undo();
    expect(instancesOf(session)).toHaveLength(before);
  });

  it("ignores an unknown entry", () => {
    const session = setup();
    const before = instancesOf(session).length;
    runAddPart(session, "nope");
    expect(instancesOf(session)).toHaveLength(before);
  });
});

describe("StructureActions", () => {
  it("renders Add part, Suggest wires and Tidy wires", () => {
    const markup = renderToStaticMarkup(
      <StructureSessionContext value={createTestSession()}>
        <StructureActions structure={{ parts: [], wires: [] }} />
      </StructureSessionContext>,
    );
    expect(markup).toContain('aria-label="Add part…"');
    expect(markup).toContain(">Suggest wires<");
    expect(markup).toContain(">Tidy wires<");
  });
});
