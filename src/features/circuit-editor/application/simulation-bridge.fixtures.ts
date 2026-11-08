import { assert } from "vitest";

import type { ProjectRepository } from "~/features/persistence";
import { createDemoProject, piece } from "~/features/projects";
import type { Project } from "~/features/projects";
import type { EngineClient, EngineEvent, ToEngine } from "~/features/simulation";
import { ok } from "~/shared/result";

import { createEditorStore, openCircuit } from "./editor-store";
import { connectSimulation, createSimulationStore } from "./simulation-bridge";

const repo: ProjectRepository = {
  // oxlint-disable-next-line unicorn/no-useless-undefined -- Result<void, _> success carries no value
  save: () => Promise.resolve(ok(undefined)),
  load: () => Promise.reject(new Error("unused")),
  list: () => Promise.resolve(ok([])),
  // oxlint-disable-next-line unicorn/no-useless-undefined -- Result<void, _> success carries no value
  delete: () => Promise.resolve(ok(undefined)),
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

export const setup = (project: Project = createDemoProject("Bridge")) => {
  const editor = createEditorStore(project, repo);
  const simulation = createSimulationStore();
  const fake = fakeClient();
  const { disconnect, clock } = connectSimulation(editor, simulation, fake.client);
  return { project, editor, simulation, disconnect, clock, ...fake };
};

export const pinsOf = (editor: ReturnType<typeof setup>["editor"]) => {
  const [pinA, pinB, pinOut] = openCircuit(editor.getState()).pins;
  assert(pinA !== undefined && pinB !== undefined && pinOut !== undefined);
  return { pinA, pinB, pinOut };
};

export const placeNand = (editor: ReturnType<typeof setup>["editor"]) => ({
  type: "placeChip" as const,
  chipId: editor.getState().chipId,
  /* oxlint-disable-next-line eslint/id-length -- `x` and `y` are coordinate names */
  instance: piece({ type: "nand" }, { x: 480, y: 0 }),
});
