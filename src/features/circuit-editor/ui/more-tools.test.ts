import { describe, expect, it, vi } from "vitest";

import { moreToolEntries, runMoreTool } from "./more-tools";
import type { MoreToolHandlers } from "./more-tools";

const handlersOf = () => {
  const handlers = {
    send: vi.fn<MoreToolHandlers["send"]>(),
    openWireColor: vi.fn<MoreToolHandlers["openWireColor"]>(),
    exportProject: vi.fn<MoreToolHandlers["exportProject"]>(),
    pickFile: vi.fn<MoreToolHandlers["pickFile"]>(),
  };
  return handlers;
};

describe("moreToolEntries", () => {
  it("lists the less frequent tools in menu order", () => {
    expect(moreToolEntries().map((entry) => entry.id)).toEqual([
      "wireColor",
      "tidyWires",
      "suggestWires",
      "showHelp",
      "export",
      "import",
    ]);
  });

  it("labels each entry with its toolbar text", () => {
    expect(moreToolEntries().map((entry) => entry.label)).toEqual([
      "Colour for new wires",
      "Tidy wires",
      "Suggest wires",
      "Keyboard shortcuts",
      "Export",
      "Import",
    ]);
  });
});

describe("runMoreTool", () => {
  it.each(["tidyWires", "suggestWires", "showHelp"] as const)(
    "sends the %s canvas command",
    (id) => {
      const handlers = handlersOf();
      runMoreTool(id, handlers);
      expect(handlers.send).toHaveBeenCalledExactlyOnceWith({ type: id });
    },
  );

  it("opens the wire colour dialog", () => {
    const handlers = handlersOf();
    runMoreTool("wireColor", handlers);
    expect(handlers.openWireColor).toHaveBeenCalledOnce();
    expect(handlers.send).not.toHaveBeenCalled();
  });

  it("exports the project", () => {
    const handlers = handlersOf();
    runMoreTool("export", handlers);
    expect(handlers.exportProject).toHaveBeenCalledOnce();
  });

  it("opens the file picker to import", () => {
    const handlers = handlersOf();
    runMoreTool("import", handlers);
    expect(handlers.pickFile).toHaveBeenCalledOnce();
  });

  it("does nothing for an unknown id", () => {
    const handlers = handlersOf();
    runMoreTool("unknown", handlers);
    for (const handler of Object.values(handlers)) {
      expect(handler).not.toHaveBeenCalled();
    }
  });
});
