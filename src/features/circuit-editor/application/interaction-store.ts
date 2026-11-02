import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

import { newWireId } from "~/shared/ids";

import type { Camera } from "../domain/camera";
import { createLayoutCache } from "../domain/chip-layout";
import type { LayoutCache, Size } from "../domain/chip-layout";
import type { Scene } from "../domain/geometry";
import { buildIndex } from "../domain/hit-test";
import type { SpatialIndex } from "../domain/hit-test";
import { interact } from "../domain/interact";
import { initialInteraction } from "../domain/interaction";
import type {
  Announcement,
  Effect,
  InteractionContext,
  InteractionInput,
  InteractionState,
  Tool,
} from "../domain/interaction";
import { openCircuit } from "./editor-store";
import type { EditorState, EditorStore } from "./editor-store";
import type { ViewSync } from "./view-sync";

interface InteractionStoreState extends InteractionState {
  /** The latest announcement for the live region; `id` changes even when the words repeat. */
  readonly announcement?: { readonly id: number; readonly announcement: Announcement };
  readonly send: (input: InteractionInput) => void;
  /** Takes a camera from outside (a back/forward navigation) without writing it back to the URL. */
  readonly syncCamera: (camera: Camera) => void;
}

type InteractionStore = StoreApi<InteractionStoreState>;

export interface InteractionDeps {
  readonly editor: EditorStore;
  readonly camera: Camera;
  readonly tool: Tool;
  /** The canvas size in CSS pixels, read when a command needs it (zoom about the centre, fit). */
  readonly viewport: () => Size;
  readonly view: Pick<ViewSync, "changed" | "settle">;
}

export interface InteractionHandle {
  readonly store: InteractionStore;
  /** Shared with the renderer, so a chip is laid out once per change. */
  readonly layout: LayoutCache;
  readonly sceneOf: (editor: EditorState) => Scene;
  /** Prunes the selection whenever the editor's history changes; returns the disconnect. */
  readonly connect: () => () => void;
}

/** Builds the hit-test index only when an input needs it, and once per circuit. */
const createIndexCache = () => {
  const cache: { built?: { readonly scene: Scene; readonly index: SpatialIndex } } = {};
  return (scene: Scene): SpatialIndex => {
    const { built } = cache;
    if (built?.scene.circuit === scene.circuit && built.scene.project === scene.project) {
      return built.index;
    }
    const index = buildIndex(scene);
    cache.built = { scene, index };
    return index;
  };
};

type EffectHandlers = {
  readonly [Type in Effect["type"]]: (
    deps: InteractionDeps,
    effect: Extract<Effect, { type: Type }>,
  ) => void;
};

// Compiler-linked: adding an effect without a handler here fails typecheck.
const EFFECTS: EffectHandlers = {
  dispatch: (deps, effect) => {
    deps.editor.getState().dispatch(effect.action);
  },
  undo: (deps) => {
    deps.editor.getState().undo();
  },
  redo: (deps) => {
    deps.editor.getState().redo();
  },
  setInput: (deps, effect) => {
    deps.editor.getState().setInput(effect.pinId, effect.value);
  },
  cameraSettled: (deps) => {
    deps.view.settle();
  },
  announce: () => {
    // The store numbers and keeps announcements itself.
  },
};

const applyEffect = <Type extends Effect["type"]>(
  deps: InteractionDeps,
  effect: Extract<Effect, { type: Type }>,
): void => {
  EFFECTS[effect.type](deps, effect);
};

type Announced = InteractionStoreState["announcement"];

/** The newest announcement among `effects`, numbered after `count`; else the previous one. */
const latestAnnouncement = (
  effects: readonly Effect[],
  previous: Announced,
  count: number,
): Announced => {
  const said = effects.findLast((effect) => effect.type === "announce");
  return said === undefined ? previous : { id: count + 1, announcement: said.announcement };
};

/** Sends `historyChanged` whenever the open chip or its history changes; returns the stop. */
const watchHistory = (editor: EditorStore, store: InteractionStore): (() => void) =>
  editor.subscribe((state, previous) => {
    if (state.history.present !== previous.history.present || state.chipId !== previous.chipId) {
      store.getState().send({ type: "historyChanged" });
    }
  });

/**
 * The canvas interaction store (spec §5.3): runs `interact`, applies its effects (edits go to the
 * editor, so undo works as usual), mirrors camera moves to the URL through `view`, and prunes the
 * selection whenever the open chip's history changes.
 */
export const createInteractionStore = (deps: InteractionDeps): InteractionHandle => {
  const layout = createLayoutCache();
  const indexOf = createIndexCache();
  const sceneOf = (editor: EditorState): Scene => ({
    project: editor.history.present,
    circuit: openCircuit(editor),
    layout,
  });
  const contextOf = (): InteractionContext => {
    const editor = deps.editor.getState();
    const scene = sceneOf(editor);
    const index = (): SpatialIndex => indexOf(scene);
    return {
      scene,
      chipId: editor.chipId,
      viewport: deps.viewport(),
      index,
      newWireId: () => newWireId(),
      inputs: editor.inputs,
    };
  };
  let announced = 0;
  const store = createStore<InteractionStoreState>((set, get) => ({
    ...initialInteraction(deps.camera, deps.tool),
    send: (input) => {
      const before = get();
      const { state, effects } = interact(before, input, contextOf());
      const announcement = latestAnnouncement(effects, before.announcement, announced);
      announced = announcement?.id ?? announced;
      // Replaced, not merged: overlays and drags that ended must disappear from the state.
      const { send, syncCamera } = before;
      set(
        { ...state, send, syncCamera, ...(announcement === undefined ? {} : { announcement }) },
        true,
      );
      if (state.camera !== before.camera) {
        deps.view.changed(state.camera);
      }
      for (const effect of effects) {
        applyEffect(deps, effect);
      }
    },
    syncCamera: (camera) => {
      set({ camera });
    },
  }));

  return { store, layout, sceneOf, connect: () => watchHistory(deps.editor, store) };
};
