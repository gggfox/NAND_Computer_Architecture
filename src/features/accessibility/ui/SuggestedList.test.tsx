import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { openCircuit, structureOf } from "~/features/circuit-editor";
import type { EditorSession, InteractionCommand } from "~/features/circuit-editor";
import { parseProjectFile } from "~/features/projects";
import { newInstanceId, newPinId } from "~/shared/ids";

import { StructureSessionContext } from "./structure-session";
import { createTestSession } from "./structure-session.fixtures";
import { runAddPart } from "./StructureActions";
import { ghostEndText, SuggestedList, SuggestedRows } from "./SuggestedList";

const noop = (): void => undefined;

const sceneOf = (session: EditorSession) => session.interaction.sceneOf(session.editor.getState());

const send = (session: EditorSession, command: InteractionCommand): void => {
  session.interaction.store.getState().send({ type: "command", command });
};

/** The list as the view shows it: the rows for the ghosts in the store, or nothing. */
const render = (session: EditorSession): string => {
  const ghosts = session.interaction.store.getState().suggestions?.ghosts ?? [];
  const structure = structureOf(sceneOf(session));
  return ghosts.length === 0
    ? ""
    : renderToStaticMarkup(<SuggestedRows structure={structure} ghosts={ghosts} send={noop} />);
};

const wiresOf = (session: EditorSession): number =>
  openCircuit(session.editor.getState()).wires.length;

const ghostsOf = (session: EditorSession): number =>
  session.interaction.store.getState().suggestions?.ghosts.length ?? 0;

/** The register file: four `Reg` chips with no wires, so Suggest wires proposes 20. */
const registerFile = () => {
  const parsed = parseProjectFile(readFileSync("e2e/fixtures/register-file.json", "utf-8"));
  if (!parsed.ok) {
    throw new Error("The register-file fixture parses");
  }
  return parsed.value;
};

const FILE_GHOSTS = 20;

const fileSession = (): EditorSession => {
  const session = createTestSession(registerFile());
  session.interaction.connect();
  return session;
};

const withGhosts = (): EditorSession => {
  const session = fileSession();
  send(session, { type: "suggestWires" });
  return session;
};

describe("SuggestedList", () => {
  it("shows nothing while there are no suggestions", () => {
    const session = fileSession();
    expect(render(session)).toBe("");
    const markup = renderToStaticMarkup(
      <StructureSessionContext value={session}>
        <SuggestedList structure={structureOf(sceneOf(session))} />
      </StructureSessionContext>,
    );
    expect(markup).toBe("");
  });

  it("lists each ghost as a row with an Accept button, and Accept all and Dismiss", () => {
    const session = withGhosts();
    const count = ghostsOf(session);
    expect(count).toBe(FILE_GHOSTS);
    const markup = render(session);
    expect(markup).toContain(`Suggested wires: ${String(count)}`);
    expect(markup.match(/<li/gu)).toHaveLength(count);
    expect(markup).toMatch(/<span>[^<]* of [^<]* to [^<]* of [^<]*<\/span>/u);
    expect(markup).toContain('aria-label="Accept wire ');
    expect(markup).toContain(">Accept all<");
    expect(markup).toContain(">Dismiss<");
  });

  it("changes nothing in the circuit before Accept", () => {
    const session = fileSession();
    const before = wiresOf(session);
    send(session, { type: "suggestWires" });
    expect(ghostsOf(session)).toBe(FILE_GHOSTS);
    expect(wiresOf(session)).toBe(before);
  });
});

describe("SuggestedList actions", () => {
  it("Accept on one row adds one wire", () => {
    const session = withGhosts();
    const before = wiresOf(session);
    const count = ghostsOf(session);
    send(session, { type: "acceptGhost", index: 0 });
    expect(wiresOf(session)).toBe(before + 1);
    expect(ghostsOf(session)).toBe(count - 1);
  });

  it("Accept all is one undo step", () => {
    const session = withGhosts();
    const before = wiresOf(session);
    send(session, { type: "acceptAllGhosts" });
    expect(wiresOf(session)).toBeGreaterThan(before);
    session.editor.getState().undo();
    expect(wiresOf(session)).toBe(before);
  });

  it("Dismiss clears the list and leaves the circuit as it was", () => {
    const session = withGhosts();
    const before = wiresOf(session);
    send(session, { type: "dismissGhosts" });
    expect(wiresOf(session)).toBe(before);
    expect(render(session)).toBe("");
  });

  it("any edit clears the list", () => {
    const session = withGhosts();
    runAddPart(session, "nand");
    expect(ghostsOf(session)).toBe(0);
    expect(render(session)).toBe("");
  });
});

describe("ghostEndText", () => {
  it("is empty for a pin that is not in the structure", () => {
    const session = createTestSession();
    const structure = structureOf(sceneOf(session));
    const [part] = structure.parts;
    expect(
      ghostEndText(structure, { instanceId: part?.instanceId ?? newInstanceId(), pin: newPinId() }),
    ).toBe("");
  });
});
