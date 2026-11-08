import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { openCircuit, structureOf } from "~/features/circuit-editor";
import type { EditorSession, WireEntry } from "~/features/circuit-editor";

import { StructureSessionContext } from "./structure-session";
import { createTestSession } from "./structure-session.fixtures";
import { runWireAction } from "./wire-actions-run";
import { WireActions } from "./WireActions";

const setup = (): { session: EditorSession; wire: WireEntry } => {
  const session = createTestSession();
  const { present } = session.editor.getState().history;
  const circuit = openCircuit(session.editor.getState());
  const [wire] = structureOf({ project: present, circuit }).wires;
  if (wire === undefined) {
    throw new Error("The demo has wires");
  }
  return { session, wire };
};

const wiresOf = (session: EditorSession) => openCircuit(session.editor.getState()).wires;

const selectedWires = (session: EditorSession): ReadonlySet<string> =>
  session.interaction.store.getState().selection.wires;

describe("WireActions", () => {
  it("renders a menu button named for the wire", () => {
    const { session, wire } = setup();
    const markup = renderToStaticMarkup(
      <StructureSessionContext value={session}>
        <WireActions wire={wire} />
      </StructureSessionContext>,
    );
    expect(markup).toContain(`aria-label="Actions for wire ${wire.label}"`);
  });

  it("selects the wire and deletes it; undo restores it", () => {
    const { session, wire } = setup();
    const before = wiresOf(session).length;
    runWireAction(session, wire, { id: "delete" });
    expect(wiresOf(session).some((item) => item.id === wire.wireId)).toBe(false);
    expect(wiresOf(session)).toHaveLength(before - 1);
    session.editor.getState().undo();
    expect(wiresOf(session)).toHaveLength(before);
  });

  it("starts bend mode for the wire", () => {
    const { session, wire } = setup();
    runWireAction(session, wire, { id: "bends" });
    expect(session.interaction.store.getState().bends).toBeDefined();
    expect(selectedWires(session).has(wire.wireId)).toBe(true);
  });

  it("selects the wire for re-route", () => {
    const { session, wire } = setup();
    runWireAction(session, wire, { id: "reroute" });
    expect(selectedWires(session).has(wire.wireId)).toBe(true);
  });

  it("selects the wire and arms a new wire for branch", () => {
    const { session, wire } = setup();
    runWireAction(session, wire, { id: "branch" });
    expect(selectedWires(session).has(wire.wireId)).toBe(true);
    expect(session.interaction.store.getState().armed).toBeDefined();
  });

  it("colours the wire in one undo step", () => {
    const { session, wire } = setup();
    runWireAction(session, wire, { id: "color", color: "red" });
    expect(wiresOf(session).find((item) => item.id === wire.wireId)?.color).toBe("red");
    session.editor.getState().undo();
    expect(wiresOf(session).find((item) => item.id === wire.wireId)?.color).toBe(wire.color);
  });
});
