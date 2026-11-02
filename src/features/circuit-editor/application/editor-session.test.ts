/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { createDemoProject } from "~/features/projects";

import { createEditorSession } from "./editor-session";
import { fakeRepo, SAVED } from "./editor-store.fixtures";

const sessionOf = () =>
  createEditorSession(createDemoProject("x"), fakeRepo(SAVED).repo, [
    {
      camera: { zoom: 1, x: 0, y: 0 },
      write: () => {
        // Camera writes are not under test.
      },
    },
    "select",
  ]).session;

describe("clientToCanvas", () => {
  it("subtracts the canvas's left and top", () => {
    const session = sessionOf();
    session.attachViewport(() => ({ left: 100, top: 50, width: 400, height: 300 }));
    expect(session.clientToCanvas({ x: 150, y: 70 })).toEqual({ x: 50, y: 20 });
  });

  it("is undefined outside the canvas", () => {
    const session = sessionOf();
    session.attachViewport(() => ({ left: 100, top: 50, width: 400, height: 300 }));
    expect(session.clientToCanvas({ x: 99, y: 70 })).toBeUndefined();
    expect(session.clientToCanvas({ x: 150, y: 350 })).toBeUndefined();
    expect(session.clientToCanvas({ x: 500, y: 70 })).toBeUndefined();
    expect(session.clientToCanvas({ x: 150, y: 49 })).toBeUndefined();
  });

  it("is undefined once the canvas detaches", () => {
    const session = sessionOf();
    const detach = session.attachViewport(() => ({ left: 0, top: 0, width: 400, height: 300 }));
    detach();
    expect(session.clientToCanvas({ x: 10, y: 10 })).toBeUndefined();
  });
});
