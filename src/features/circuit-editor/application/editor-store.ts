import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

import type { PersistenceError, ProjectRepository } from "~/features/persistence";
import type { Project } from "~/features/projects";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { EditorAction, EditorError } from "../domain/actions";
import { createHistory, pushHistory, redo, undo } from "../domain/history";
import type { History } from "../domain/history";
import { applyAction } from "../domain/reducer";

const SAVE_DEBOUNCE_MS = 300;

type Level = 0 | 1;
type LastError = EditorError | PersistenceError | null;

export interface EditorState {
  readonly history: History<Project>;
  readonly lastError: LastError;
  readonly inputs: readonly Level[];
  readonly dispatch: (action: EditorAction) => Result<void, EditorError>;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly setInput: (index: number, value: Level) => void;
}

export type EditorStore = StoreApi<EditorState>;

// oxlint-disable-next-line unicorn/no-null -- `null` is the documented "no error" value of the store state
const NO_ERROR: LastError = null;

const countInputs = (project: Project): number =>
  project.rootCircuit.instances.filter(
    (item) => item.kind.type === "builtin" && item.kind.builtin === "input",
  ).length;

/** Keeps existing levels, pads new inputs with 0 and drops removed ones. */
const resizeInputs = (inputs: readonly Level[], count: number): readonly Level[] =>
  Array.from({ length: count }, (_unused, index) => inputs[index] ?? 0);

/** Trailing-edge debounce: only the latest scheduled call runs. */
const createDebounce = (delayMs: number): ((run: () => void) => void) => {
  let timer: ReturnType<typeof setTimeout> | undefined = undefined;
  return (run) => {
    clearTimeout(timer);
    timer = setTimeout(run, delayMs);
  };
};

type Set = StoreApi<EditorState>["setState"];
type Get = StoreApi<EditorState>["getState"];

const createCommit = (
  set: Set,
  get: Get,
  repo: ProjectRepository,
): ((next: History<Project>) => void) => {
  const schedule = createDebounce(SAVE_DEBOUNCE_MS);
  const persist = async (): Promise<void> => {
    try {
      const result = await repo.save(get().history.present);
      if (!result.ok) {
        set({ lastError: result.error });
      }
    } catch {
      // A repository that rejects or throws is treated as unavailable storage.
      set({ lastError: { type: "Unavailable" } });
    }
  };
  return (next) => {
    set((state) => ({
      history: next,
      inputs: resizeInputs(state.inputs, countInputs(next.present)),
    }));
    schedule(() => {
      void persist();
    });
  };
};

const withInput = (state: EditorState, index: number, value: Level): Partial<EditorState> =>
  index >= 0 && index < state.inputs.length
    ? { inputs: state.inputs.map((level, at) => (at === index ? value : level)) }
    : {};

export const createEditorStore = (project: Project, repo: ProjectRepository): EditorStore =>
  createStore<EditorState>((set, get) => {
    const commit = createCommit(set, get, repo);
    const step = (move: (history: History<Project>) => History<Project>): void => {
      const next = move(get().history);
      if (next !== get().history) {
        commit(next);
      }
    };
    return {
      history: createHistory(project),
      lastError: NO_ERROR,
      inputs: resizeInputs([], countInputs(project)),
      dispatch: (action) => {
        const result = applyAction(get().history.present, action);
        if (!result.ok) {
          set({ lastError: result.error });
          return err(result.error);
        }
        set({ lastError: NO_ERROR });
        commit(pushHistory(get().history, result.value));
        // oxlint-disable-next-line unicorn/no-useless-undefined -- Result<void, _> success carries no value
        return ok(undefined);
      },
      undo: () => {
        step(undo);
      },
      redo: () => {
        step(redo);
      },
      setInput: (index, value) => {
        set((state) => withInput(state, index, value));
      },
    };
  });
