import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

import type { PersistenceError, ProjectRepository } from "~/features/persistence";
import { applySavedVersion, EMPTY_CIRCUIT, findChip } from "~/features/projects";
import type { Chip, Circuit, Project } from "~/features/projects";
import type { ChipId, PinId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { EditorAction, EditorError } from "../domain/actions";
import { repairTrail, trailInto, trailTo } from "../domain/breadcrumbs";
import type { Trail } from "../domain/breadcrumbs";
import { createHistory, mapHistory, pushHistory, redo, undo } from "../domain/history";
import type { History } from "../domain/history";
import { applyAction } from "../domain/reducer";
import { createRerouteAfterSave, createRouteUnrouted } from "../domain/route-edits";

const SAVE_DEBOUNCE_MS = 300;

type LastError = EditorError | PersistenceError | null;

export interface EditorState {
  readonly history: History<Project>;
  /** The chip being edited; starts at the project's `lastOpenedChipId`. */
  readonly chipId: ChipId;
  /** The chips opened with Look inside, outermost first; the last one is always `chipId`. */
  readonly trail: Trail;
  readonly lastError: LastError;
  /** The value set on each of the open chip's input pins; a missing pin reads as 0. */
  readonly inputs: ReadonlyMap<PinId, number>;
  readonly dispatch: (action: EditorAction) => Result<void, EditorError>;
  /** Opens another chip for editing, starting a fresh trail. Not an edit: history is untouched. */
  readonly openChip: (chipId: ChipId) => Result<void, EditorError>;
  /** Opens a chip placed in the open one and adds it to the trail. */
  readonly lookInside: (chipId: ChipId) => Result<void, EditorError>;
  /** Goes back to the trail item at `index`; no-op out of range or on the last item. */
  readonly goBack: (index: number) => void;
  readonly undo: () => void;
  readonly redo: () => void;
  /** Sets an input pin of the open chip; any other pin id is ignored. */
  readonly setInput: (pinId: PinId, value: number) => void;
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
  /** Sets the history, and the open chip when given, in one update, then schedules an autosave. */
  readonly commit: (next: History<Project>, chipId?: ChipId) => void;
  /** Autosaves without an edit, for a change that lives outside history (the open chip). */
  readonly touch: () => void;
  readonly flush: () => Promise<void>;
}
type Get = StoreApi<EditorState>["getState"];

const createCommit = (set: Set, get: Get, repo: ProjectRepository): Commit => {
  const { schedule, flush } = createDebounce(SAVE_DEBOUNCE_MS);
  const persist = async (): Promise<void> => {
    try {
      const { history, chipId } = get();
      const result = await repo.save({ ...history.present, lastOpenedChipId: chipId });
      if (!result.ok) {
        set({ lastError: result.error });
      }
    } catch {
      // A repository that rejects or throws is treated as unavailable storage.
      set({ lastError: { type: "Unavailable" } });
    }
  };
  return {
    commit: (next, chipId) => {
      const open = chipId ?? get().chipId;
      const trail = repairTrail(get().trail, next.present, open);
      set(chipId === undefined ? { history: next, trail } : { history: next, chipId, trail });
      schedule(persist);
    },
    touch: () => {
      schedule(persist);
    },
    flush,
  };
};

const isOpenInput = (state: EditorState, pinId: PinId): boolean =>
  openCircuit(state).pins.some((pin) => pin.id === pinId && pin.direction === "input");

const withInput = (state: EditorState, pinId: PinId, value: number): Partial<EditorState> =>
  isOpenInput(state, pinId) && state.inputs.get(pinId) !== value
    ? { inputs: new Map(state.inputs).set(pinId, value) }
    : {};

/**
 * Saving rewrites every snapshot (spec §5.11): the saved version is the same across the whole
 * history, so undo never reverts a save and the save itself is not an undo step.
 */
const savedEverywhere = (history: History<Project>, chipId: ChipId): History<Project> => {
  const saved = draftOf(history.present, chipId);
  const reroute = createRerouteAfterSave(chipId);
  return mapHistory(history, (snapshot) =>
    reroute(snapshot, applySavedVersion(snapshot, chipId, saved)),
  );
};

/**
 * Creating a chip adds it to every snapshot, so it is not an undo step either: chips never
 * vanish through undo or redo, and a saved version placing the chip (a save rewrites every
 * snapshot) always finds it.
 */
const createdEverywhere = (history: History<Project>, created: Chip): History<Project> =>
  mapHistory(history, (snapshot) =>
    findChip(snapshot, created.id) === undefined
      ? { ...snapshot, chips: [...snapshot.chips, created] }
      : snapshot,
  );

const nextHistory = (
  history: History<Project>,
  action: EditorAction,
  project: Project,
): History<Project> => {
  if (action.type === "saveChip") {
    return savedEverywhere(history, action.chipId);
  }
  if (action.type === "deleteChip") {
    return createHistory(project);
  }
  const created = action.type === "createChip" ? findChip(project, action.chipId) : undefined;
  return created === undefined
    ? pushHistory(history, project)
    : createdEverywhere(history, created);
};

interface Edits {
  readonly get: Get;
  readonly set: Set;
  readonly commit: Commit["commit"];
}

/**
 * Deleting the open chip opens the first remaining one (D4). It is committed with the history,
 * so no subscriber sees a project without the open chip.
 */
const chipAfter = (open: ChipId, action: EditorAction, project: Project): ChipId => {
  const [first] = project.chips;
  return action.type === "deleteChip" && action.chipId === open && first !== undefined
    ? first.id
    : open;
};

const applyEdit = (
  { get, set, commit }: Edits,
  action: EditorAction,
): Result<void, EditorError> => {
  const result = applyAction(get().history.present, action);
  if (!result.ok) {
    set({ lastError: result.error });
    return err(result.error);
  }
  set({ lastError: NO_ERROR });
  // An edit that changed nothing (Tidy on tidy wires, the same colour) is no undo step.
  if (result.value !== get().history.present) {
    const { chipId } = get();
    const next = chipAfter(chipId, action, result.value);
    commit(nextHistory(get().history, action, result.value), next === chipId ? undefined : next);
  }
  // oxlint-disable-next-line unicorn/no-useless-undefined -- Result<void, _> success carries no value
  return ok(undefined);
};

type Navigation = Pick<EditorState, "openChip" | "lookInside" | "goBack">;

/** Opening a chip: they all route the wires it has none for, and none is an edit. */
const createNavigation = (get: Get, set: Set, touch: () => void): Navigation => {
  const switchTo = (
    chipId: ChipId,
    trailFor: (trail: Trail) => Trail,
  ): Result<void, EditorError> => {
    if (findChip(get().history.present, chipId) === undefined) {
      return err({ type: "ChipNotFound", chipId });
    }
    set({
      chipId,
      trail: trailFor(get().trail),
      history: mapHistory(get().history, createRouteUnrouted()),
    });
    touch();
    // oxlint-disable-next-line unicorn/no-useless-undefined -- Result<void, _> success carries no value
    return ok(undefined);
  };
  return {
    openChip: (chipId) => switchTo(chipId, () => [chipId]),
    lookInside: (chipId) => {
      const result = switchTo(chipId, (trail) => trailInto(trail, chipId));
      if (!result.ok) {
        set({ lastError: result.error });
      }
      return result;
    },
    goBack: (index) => {
      const trail = trailTo(get().trail, index);
      const target = trail.at(-1);
      if (target !== undefined && trail.length < get().trail.length) {
        switchTo(target, () => trail);
      }
    },
  };
};

export const createEditorStore = (project: Project, repo: ProjectRepository): EditorStore =>
  createStore<EditorState>((set, get) => {
    const { commit, touch, flush } = createCommit(set, get, repo);
    const step = (move: (history: History<Project>) => History<Project>): void => {
      const next = move(get().history);
      if (next !== get().history) {
        commit(next);
      }
    };
    const { openChip, lookInside, goBack } = createNavigation(get, set, touch);
    return {
      // Routing wires that have none (files from before the router) is not an edit.
      history: createHistory(createRouteUnrouted()(project)),
      chipId: project.lastOpenedChipId,
      trail: [project.lastOpenedChipId],
      lastError: NO_ERROR,
      inputs: new Map(),
      dispatch: (action) => applyEdit({ get, set, commit }, action),
      openChip,
      lookInside,
      goBack,
      undo: () => {
        step(undo);
      },
      redo: () => {
        step(redo);
      },
      setInput: (pinId, value) => {
        set((state) => withInput(state, pinId, value));
      },
      flush,
    };
  });
