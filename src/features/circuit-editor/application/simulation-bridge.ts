import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

import {
  DEFAULT_STEPS_PER_SECOND,
  MAX_STEPS_PER_SECOND,
  MIN_STEPS_PER_SECOND,
} from "~/features/simulation";
import type { EngineClient, EngineEvent } from "~/features/simulation";
import type { PinId } from "~/shared/ids";

import { packInputs, unpackOutputs } from "../domain/io-layout";
import type { IoLayout } from "../domain/io-layout";
import type { SimulationError } from "../domain/messages";
import type { Level } from "../domain/signals";
import { toNetlistSource } from "../domain/to-netlist-source";
import type { Flattened } from "../domain/to-netlist-source";
import type { EditorState, EditorStore } from "./editor-store";

export interface SimulationState {
  /** The engine's last reported value per output pin; empty until it answers or while invalid. */
  readonly outputs: ReadonlyMap<PinId, number>;
  readonly clock: Level;
  readonly running: boolean;
  readonly stepsPerSecond: number;
  readonly error: SimulationError | null;
}

export type SimulationStore = StoreApi<SimulationState>;

export interface ClockControls {
  readonly play: () => void;
  readonly pause: () => void;
  readonly step: () => void;
  /**
   * Clamped to the engine's speed range; the clamped value is stored in `stepsPerSecond`.
   * A non-finite value keeps the current speed.
   */
  readonly setSpeed: (stepsPerSecond: number) => void;
}

export interface SimulationConnection {
  readonly disconnect: () => void;
  readonly clock: ClockControls;
}

// oxlint-disable-next-line unicorn/no-null -- `null` is the documented "no error" value of the store state
const NO_ERROR: SimulationError | null = null;
const NO_OUTPUTS: ReadonlyMap<PinId, number> = new Map();
const EMPTY_LAYOUT: IoLayout = { inputs: [], outputs: [] };

export const createSimulationStore = (): SimulationStore =>
  createStore<SimulationState>(() => ({
    outputs: NO_OUTPUTS,
    clock: 0,
    running: false,
    stepsPerSecond: DEFAULT_STEPS_PER_SECOND,
    error: NO_ERROR,
  }));

/** Clamps to the engine's range; a non-finite request (NaN, ±Infinity) keeps `current`. */
const clampSpeed = (stepsPerSecond: number, current: number): number =>
  Number.isFinite(stepsPerSecond)
    ? Math.min(MAX_STEPS_PER_SECOND, Math.max(MIN_STEPS_PER_SECOND, stepsPerSecond))
    : current;

const createClockControls = (simulation: SimulationStore, client: EngineClient): ClockControls => ({
  play: () => {
    client.send({ type: "play" });
  },
  pause: () => {
    client.send({ type: "pause" });
  },
  step: () => {
    client.send({ type: "step" });
  },
  setSpeed: (stepsPerSecond) => {
    const clamped = clampSpeed(stepsPerSecond, simulation.getState().stepsPerSecond);
    client.send({ type: "setSpeed", stepsPerSecond: clamped });
    simulation.setState({ stepsPerSecond: clamped });
  },
});

/** Anything the open chip's flattened netlist depends on, saved nested chips included. */
const mayNeedReload = (state: EditorState, previous: EditorState): boolean =>
  state.history.present !== previous.history.present || state.chipId !== previous.chipId;

interface EngineLink {
  /**
   * Flattens the open chip and, when its netlist, layout or seed differs from the last one
   * loaded, loads it and replays every input bit. Cosmetic edits (moves, names, colours) keep
   * the engine and its running state.
   */
  readonly load: (state: EditorState) => void;
  /** Sends the input bits that changed since the last load or send. */
  readonly sendInputs: (state: EditorState) => void;
  readonly onEvent: (event: EngineEvent) => void;
}

/** `current` when `next` holds the same values, so output subscribers skip a re-render. */
const sameOrNew = (
  current: ReadonlyMap<PinId, number>,
  next: ReadonlyMap<PinId, number>,
): ReadonlyMap<PinId, number> =>
  current.size === next.size && [...next].every(([pinId, value]) => current.get(pinId) === value)
    ? current
    : next;

/** Remembers what the engine runs, so reloading an identical netlist is skipped. */
const createLoadedNetlist = () => {
  // Empty means unknown: no JSON key is empty, so the next netlist always differs.
  let loadedKey = "";
  return {
    /** Whether this netlist, layout and seed differ from the last loaded; remembers them. */
    replace: (flattened: Flattened, seed: number): boolean => {
      const key = JSON.stringify({ source: flattened.source, layout: flattened.layout, seed });
      const changed = key !== loadedKey;
      loadedKey = key;
      return changed;
    },
    /** The engine's netlist is unknown (invalid circuit, engine error): the next load sends. */
    forget: () => {
      loadedKey = "";
    },
  };
};

/** Sends only the input bits that changed since the last send or reset. */
const createInputSender = (client: EngineClient) => {
  let sentBits: readonly Level[] = [];
  return {
    send: (layout: IoLayout, inputs: ReadonlyMap<PinId, number>): void => {
      const bits = packInputs(layout, inputs);
      for (const [index, value] of bits.entries()) {
        if (sentBits[index] !== value) {
          client.send({ type: "setInput", index, value });
        }
      }
      sentBits = bits;
    },
    reset: () => {
      sentBits = [];
    },
  };
};

/** The bridge's state: the open chip's I/O layout, the bits sent, and whether it compiled. */
const createEngineLink = (simulation: SimulationStore, client: EngineClient): EngineLink => {
  // While the circuit cannot be compiled, replies to earlier requests are stale and ignored.
  let invalid = false;
  let layout = EMPTY_LAYOUT;
  const loaded = createLoadedNetlist();
  const inputs = createInputSender(client);

  const sendInputs = (state: EditorState): void => {
    if (!invalid) {
      inputs.send(layout, state.inputs);
    }
  };

  const fail = (error: SimulationError): void => {
    loaded.forget();
    simulation.setState({ outputs: NO_OUTPUTS, error });
  };

  const reload = (state: EditorState, flattened: Flattened): void => {
    ({ layout } = flattened);
    client.send({ type: "load", source: flattened.source, seed: state.history.present.seed });
    inputs.reset();
    sendInputs(state);
  };

  return {
    load: (state) => {
      const flattened = toNetlistSource(state.history.present, state.chipId);
      invalid = !flattened.ok;
      if (!flattened.ok) {
        fail(flattened.error);
      } else if (loaded.replace(flattened.value, state.history.present.seed)) {
        reload(state, flattened.value);
      }
    },
    sendInputs,
    onEvent: (event) => {
      if (event.type === "error") {
        fail(event.error);
      } else if (!invalid) {
        const { clock, running } = event;
        const outputs = sameOrNew(
          simulation.getState().outputs,
          unpackOutputs(layout, event.outputs),
        );
        simulation.setState({ outputs, clock, running, error: NO_ERROR });
      }
    },
  };
};

/**
 * Keeps the engine in step with the editor: a project or open-chip change that alters the
 * flattened netlist reloads it (then replays the input bits), every input change is forwarded
 * bit by bit, and every engine reply lands in `simulation`. A reload never pauses: the engine keeps its run state.
 * The caller owns and disposes `client`.
 */
export const connectSimulation = (
  editor: EditorStore,
  simulation: SimulationStore,
  client: EngineClient,
): SimulationConnection => {
  const link = createEngineLink(simulation, client);
  const unsubscribeEngine = client.subscribe(link.onEvent);
  const unsubscribeEditor = editor.subscribe((state, previous) => {
    if (mayNeedReload(state, previous)) {
      link.load(state);
    } else if (state.inputs !== previous.inputs) {
      link.sendInputs(state);
    }
  });
  link.load(editor.getState());

  return {
    disconnect: () => {
      unsubscribeEditor();
      unsubscribeEngine();
    },
    clock: createClockControls(simulation, client),
  };
};
