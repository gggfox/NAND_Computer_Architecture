import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

import type { PersistenceError, ProjectRepository } from "~/features/persistence";
import { EMPTY_CIRCUIT, findChip } from "~/features/projects";
import type { Circuit, Project } from "~/features/projects";
import type { ChipId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { EditorAction, EditorError } from "../domain/actions";
import { partOf } from "../domain/geometry";
import { createHistory, pushHistory, redo, undo } from "../domain/history";
import type { History } from "../domain/history";
import { applyAction } from "../domain/reducer";

const SAVE_DEBOUNCE_MS = 300;

type Level = 0 | 1;
type LastError = EditorError | PersistenceError | null;

export interface EditorState {
  readonly history: History<Project>;
  /** The chip being edited; starts at the project's `lastOpenedChipId`. */
  readonly chipId: ChipId;
  readonly lastError: LastError;
  readonly inputs: readonly Level[];
  readonly dispatch: (action: EditorAction) => Result<void, EditorError>;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly setInput: (index: number, value: Level) => void;
  /** Saves a pending (debounced) autosave now; resolves once it is written. No-op when none. */
  readonly flush: () => Promise<void>;
}

export type EditorStore = StoreApi<EditorState>;

// oxlint-disable-next-line unicorn/no-null -- `null` is the documented "no error" value of the store state
const NO_ERROR: LastError = null;

const draftOf = (project: Project, chipId: ChipId): Circuit =>
  findChip(project, chipId)?.draft ?? EMPTY_CIRCUIT;

/** The draft of the open chip, or an empty circuit when that chip is missing. */
export const openCircuit = (state: EditorState): Circuit =>
  draftOf(state.history.present, state.chipId);

const countInputs = (circuit: Circuit): number =>
  circuit.instances.filter((item) => partOf(circuit, item) === "input").length;

/** Keeps existing levels, pads new inputs with 0 and drops removed ones. */
const resizeInputs = (inputs: readonly Level[], count: number): readonly Level[] =>
  Array.from({ length: count }, (_unused, index) => inputs[index] ?? 0);

interface Debounce {
  readonly schedule: (run: () => Promise<void>) => void;
  /** Runs the pending call now, if any, and resolves when it finishes. */
  readonly flush: () => Promise<void>;
}

/** Trailing-edge debounce: only the latest scheduled call runs. */
const createDebounce = (delayMs: number): Debounce => {
  let timer: ReturnType<typeof setTimeout> | undefined = undefined;
  let pending: (() => Promise<void>) | undefined = undefined;
  const flush = async (): Promise<void> => {
    clearTimeout(timer);
    const run = pending;
    pending = undefined;
    await run?.();
  };
  return {
    schedule: (run) => {
      clearTimeout(timer);
      pending = run;
      timer = setTimeout(() => {
        void flush();
      }, delayMs);
    },
    flush,
  };
};

type Set = StoreApi<EditorState>["setState"];

interface Commit {
  readonly commit: (next: History<Project>) => void;
  readonly flush: () => Promise<void>;
}
type Get = StoreApi<EditorState>["getState"];

const createCommit = (set: Set, get: Get, repo: ProjectRepository): Commit => {
  const { schedule, flush } = createDebounce(SAVE_DEBOUNCE_MS);
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
  return {
    commit: (next) => {
      set((state) => ({
        history: next,
        inputs: resizeInputs(state.inputs, countInputs(draftOf(next.present, state.chipId))),
      }));
      schedule(persist);
    },
    flush,
  };
};

const withInput = (state: EditorState, index: number, value: Level): Partial<EditorState> =>
  index >= 0 && index < state.inputs.length
    ? { inputs: state.inputs.map((level, at) => (at === index ? value : level)) }
    : {};

export const createEditorStore = (project: Project, repo: ProjectRepository): EditorStore =>
  createStore<EditorState>((set, get) => {
    const { commit, flush } = createCommit(set, get, repo);
    const step = (move: (history: History<Project>) => History<Project>): void => {
      const next = move(get().history);
      if (next !== get().history) {
        commit(next);
      }
    };
    return {
      history: createHistory(project),
      chipId: project.lastOpenedChipId,
      lastError: NO_ERROR,
      inputs: resizeInputs([], countInputs(draftOf(project, project.lastOpenedChipId))),
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
      flush,
    };
  });
