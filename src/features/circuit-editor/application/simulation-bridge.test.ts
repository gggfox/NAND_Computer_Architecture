import { describe, expect, it } from "vitest";

import type { ProjectRepository } from "~/features/persistence";
import { createDemoProject, piece } from "~/features/projects";
import type { EngineClient, EngineEvent, ToEngine } from "~/features/simulation";
import { ok } from "~/shared/result";

import { createEditorStore } from "./editor-store";
import { connectSimulation, createSimulationStore } from "./simulation-bridge";

const repo: ProjectRepository = {
  // oxlint-disable-next-line unicorn/no-useless-undefined -- Result<void, _> success carries no value
  save: () => Promise.resolve(ok(undefined)),
  load: () => Promise.reject(new Error("unused")),
  list: () => Promise.resolve(ok([])),
};

const fakeClient = () => {
  const sent: ToEngine[] = [];
  const listeners = new Set<(event: EngineEvent) => void>();
  const client: EngineClient = {
    send: (msg) => {
      sent.push(msg);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      listeners.clear();
    },
  };
  const reply = (event: EngineEvent): void => {
    for (const listener of listeners) {
      listener(event);
    }
  };
  return { client, sent, reply, listeners };
};

const setup = () => {
  const project = createDemoProject("Bridge");
  const editor = createEditorStore(project, repo);
  const simulation = createSimulationStore();
  const fake = fakeClient();
  const disconnect = connectSimulation(editor, simulation, fake.client);
  return { project, editor, simulation, disconnect, ...fake };
};

const placeNand = () => ({
  type: "placeChip" as const,
  /* oxlint-disable-next-line eslint/id-length -- `x` and `y` are coordinate names */
  instance: piece({ type: "nand" }, { x: 480, y: 0 }),
});

describe("connectSimulation", () => {
  it("loads the netlist with the project seed and replays the inputs", () => {
    const { sent, project } = setup();
    expect(sent[0]).toMatchObject({ type: "load", seed: project.seed });
    expect(sent.slice(1)).toEqual([
      { type: "setInput", index: 0, value: 0 },
      { type: "setInput", index: 1, value: 0 },
    ]);
  });

  it("forwards only changed inputs and stores reported outputs", () => {
    const { editor, simulation, sent, reply } = setup();
    sent.length = 0;
    editor.getState().setInput(1, 1);
    expect(sent).toEqual([{ type: "setInput", index: 1, value: 1 }]);
    reply({ type: "state", tick: 3, stable: true, outputs: [1] });
    expect(simulation.getState()).toMatchObject({ outputs: [1] });
    expect(simulation.getState().error).toBeNull();
  });

  it("reports a netlist error and ignores stale replies and input changes", () => {
    const { editor, simulation, sent, reply } = setup();
    editor.getState().dispatch(placeNand());
    expect(simulation.getState().error?.type).toBe("UnconnectedPin");
    sent.length = 0;
    reply({ type: "state", tick: 1, stable: true, outputs: [0] });
    editor.getState().setInput(0, 1);
    expect(simulation.getState()).toMatchObject({ outputs: [] });
    expect(sent).toEqual([]);
  });

  it("reloads and recovers when an invalid edit is undone", () => {
    const { editor, simulation, sent, reply } = setup();
    editor.getState().dispatch(placeNand());
    sent.length = 0;
    editor.getState().undo();
    expect(sent[0]?.type).toBe("load");
    reply({ type: "state", tick: 2, stable: true, outputs: [1] });
    expect(simulation.getState()).toMatchObject({ outputs: [1] });
    expect(simulation.getState().error).toBeNull();
  });

  it("surfaces engine errors and stops listening once disconnected", () => {
    const { simulation, reply, disconnect, listeners } = setup();
    reply({ type: "error", error: { type: "WorkerFailed" } });
    expect(simulation.getState()).toEqual({ outputs: [], error: { type: "WorkerFailed" } });
    disconnect();
    expect(listeners.size).toBe(0);
  });
});
