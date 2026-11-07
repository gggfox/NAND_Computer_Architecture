import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { structureOf } from "~/features/circuit-editor";
import type { EditorSession, PartEntry } from "~/features/circuit-editor";
import { newChipId } from "~/shared/ids";
import type { InstanceId } from "~/shared/ids";

import { partEntries, PartActions, runPartAction } from "./PartActions";
import { StructureSessionContext } from "./structure-session";
import { createTestSession } from "./structure-session.fixtures";

/** One grid step on the canvas, in canvas units. */
const GRID = 40;

const sceneOf = (session: EditorSession) => session.interaction.sceneOf(session.editor.getState());

const partsOf = (session: EditorSession): readonly PartEntry[] =>
  structureOf(sceneOf(session)).parts;

const nandOf = (session: EditorSession): PartEntry => {
  const nand = partsOf(session).find((part) => part.kind === "nand");
  if (nand === undefined) {
    throw new Error("The demo circuit has a NAND gate");
  }
  return nand;
};

const positionOf = (session: EditorSession, id: InstanceId) =>
  sceneOf(session).circuit.instances.find((item) => item.id === id)?.position;

const setup = (): EditorSession => {
  const session = createTestSession();
  session.interaction.connect();
  return session;
};

describe("partEntries", () => {
  it("lists the common entries for a plain part", () => {
    expect(partEntries(false).map((entry) => entry.id)).toEqual([
      "delete",
      "duplicate",
      "array",
      "moveLeft",
      "moveRight",
      "moveUp",
      "moveDown",
    ]);
  });

  it("adds Rename, Recolor and Look inside only for a custom chip", () => {
    const ids = partEntries(true).map((entry) => entry.id);
    expect(ids).toEqual(expect.arrayContaining(["rename", "recolor", "lookInside"]));
    expect(partEntries(false).map((entry) => entry.id)).not.toContain("rename");
  });
});

describe("runPartAction", () => {
  it("selects the part, then moves it one grid step right in one undo step", () => {
    const session = setup();
    const nand = nandOf(session);
    const before = positionOf(session, nand.instanceId);
    runPartAction(session, nand, "moveRight");
    expect(session.interaction.store.getState().selection.instances.has(nand.instanceId)).toBe(
      true,
    );
    const after = positionOf(session, nand.instanceId);
    expect(after?.x).toBe((before?.x ?? 0) + GRID);
    expect(after?.y).toBe(before?.y);
    session.editor.getState().undo();
    expect(positionOf(session, nand.instanceId)).toEqual(before);
  });

  it.each([
    ["moveLeft", -GRID, 0],
    ["moveUp", 0, -GRID],
    ["moveDown", 0, GRID],
  ])("%s moves the part by one grid step", (id, dx, dy) => {
    const session = setup();
    const nand = nandOf(session);
    const before = positionOf(session, nand.instanceId);
    runPartAction(session, nand, id);
    const after = positionOf(session, nand.instanceId);
    expect(after?.x).toBe((before?.x ?? 0) + dx);
    expect(after?.y).toBe((before?.y ?? 0) + dy);
  });
});

describe("runPartAction, the other entries", () => {
  it("deletes the part and its wires, and undo restores them", () => {
    const session = setup();
    const nand = nandOf(session);
    const wires = sceneOf(session).circuit.wires.length;
    runPartAction(session, nand, "delete");
    expect(partsOf(session).some((part) => part.instanceId === nand.instanceId)).toBe(false);
    expect(sceneOf(session).circuit.wires.length).toBeLessThan(wires);
    session.editor.getState().undo();
    expect(partsOf(session).some((part) => part.instanceId === nand.instanceId)).toBe(true);
    expect(sceneOf(session).circuit.wires.length).toBe(wires);
  });

  it("duplicates the part", () => {
    const session = setup();
    const count = partsOf(session).length;
    runPartAction(session, nandOf(session), "duplicate");
    expect(partsOf(session).length).toBe(count + 1);
  });

  it("opens the Array dialog", () => {
    const session = setup();
    runPartAction(session, nandOf(session), "array");
    expect(session.interaction.store.getState().arraying).toBe(true);
  });

  it("returns a Rename and a Recolor dialog for a custom chip, and no dialog for a plain part", () => {
    const session = setup();
    const { chipId } = session.editor.getState();
    const custom: PartEntry = { ...nandOf(session), kind: "custom", custom: chipId };
    expect(runPartAction(session, custom, "rename")?.kind).toBe("rename");
    expect(runPartAction(session, custom, "recolor")?.kind).toBe("recolor");
    expect(runPartAction(session, nandOf(session), "rename")).toBeUndefined();
  });

  it("opens the chip of a custom part with Look inside", () => {
    const session = setup();
    const chipId = newChipId();
    session.editor
      .getState()
      .dispatch({ type: "createChip", chipId, name: "Inner", color: "#3b82f6" });
    const custom: PartEntry = { ...nandOf(session), kind: "custom", custom: chipId };
    runPartAction(session, custom, "lookInside");
    expect(session.editor.getState().chipId).toBe(chipId);
  });
});

describe("PartActions", () => {
  it("renders a button named after the part", () => {
    const session = createTestSession();
    const nand = nandOf(session);
    const markup = renderToStaticMarkup(
      <StructureSessionContext value={session}>
        <PartActions part={nand} />
      </StructureSessionContext>,
    );
    expect(markup).toContain(`aria-label="Actions for ${nand.label}"`);
  });
});
