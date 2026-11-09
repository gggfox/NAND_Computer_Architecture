/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createDemoProject } from "~/features/projects";

import { createEditorSession } from "../application/editor-session";
import { fakeRepo, SAVED } from "../application/editor-store.fixtures";
import { EditorToolbar } from "./EditorToolbar";
import { ZoomCorner } from "./ZoomCorner";

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

const toolbarHtml = (): string =>
  renderToStaticMarkup(
    <EditorToolbar
      session={sessionOf()}
      onImport={() => {
        // Imports are not under test.
      }}
    />,
  );

describe("EditorToolbar", () => {
  it("keeps the full text of each compact label as its accessible name", () => {
    const html = toolbarHtml();
    for (const name of ["Undo", "Redo", "Add NAND", "Pan", "Select"]) {
      expect(html).toContain(`>${name}</span>`);
    }
    expect(html).toContain('aria-hidden="true">+ NAND</span>');
  });

  it("has a named More tools menu button next to the wide-screen tools", () => {
    const html = toolbarHtml();
    expect(html).toContain('aria-label="More tools"');
    for (const name of ["Tidy wires", "Suggest wires", "Fit", "Export", "Import"]) {
      expect(html).toContain(name);
    }
  });

  it("keeps a hidden project file input for the menu's Import", () => {
    expect(toolbarHtml()).toMatch(/<input[^>]*type="file"[^>]*accept="application\/json,\.json"/u);
  });
});

describe("ZoomCorner", () => {
  it("is a named button with a decorative icon", () => {
    const html = renderToStaticMarkup(<ZoomCorner session={sessionOf()} />);
    expect(html).toContain('aria-label="Zoom"');
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/u);
  });
});
