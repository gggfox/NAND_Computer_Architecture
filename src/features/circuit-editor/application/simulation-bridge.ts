import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

import {
  DEFAULT_STEPS_PER_SECOND,
  MAX_STEPS_PER_SECOND,
  MIN_STEPS_PER_SECOND,
} from "~/features/simulation";
import type { EngineClient, EngineEvent, NetlistSource } from "~/features/simulation";
import type { PinId } from "~/shared/ids";

import { packInputs, unpackOutputs } from "../domain/io-layout";
import type { IoLayout } from "../domain/io-layout";
import type { SimulationError } from "../domain/messages";
import { probeLevels, withProbes } from "../domain/probes";
import type { ProbeSlot } from "../domain/probes";
import type { Level } from "../domain/signals";
import { toNetlistSource } from "../domain/to-netlist-source";
import type { EditorState, EditorStore } from "./editor-store";

export interface SimulationState {
  /** The engine's last reported value per output pin; empty until it answers or while invalid. */
  readonly outputs: ReadonlyMap<PinId, number>;
  /** The engine's last reported value per pin of the open chip's parts (`pinLevelKey`). */
  readonly levels: ReadonlyMap<string, number>;
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
const NO_LEVELS: ReadonlyMap<string, number> = new Map();
const EMPTY_LAYOUT: IoLayout = { inputs: [], outputs: [] };

export const createSimulationStore = (): SimulationStore =>
  createStore<SimulationState>(() => ({
    outputs: NO_OUTPUTS,
    levels: NO_LEVELS,
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

/** `current` when `next` holds the same values, so subscribers skip a re-render or redraw. */
const sameOrNew = <Key>(
  current: ReadonlyMap<Key, number>,
  next: ReadonlyMap<Key, number>,
): ReadonlyMap<Key, number> =>
  current.size === next.size && [...next].every(([key, value]) => current.get(key) === value)
    ? current
    : next;

/** Remembers what the engine runs, so reloading an identical netlist is skipped. */
const createLoadedNetlist = () => {
  // Empty means unknown: no JSON key is empty, so the next netlist always differs.
  let loadedKey = "";
  return {
    /** Whether this netlist (probes included), layout and seed differ from the last loaded. */
    replace: (source: NetlistSource, layout: IoLayout, seed: number): boolean => {
      const key = JSON.stringify({ source, layout, seed });
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

/** How to read an engine reply: the open chip's outputs, then the probed pins. */
interface Readout {
  readonly layout: IoLayout;
  readonly slots: readonly ProbeSlot[];
}

const EMPTY_READOUT: Readout = { layout: EMPTY_LAYOUT, slots: [] };

type StateEvent = Extract<EngineEvent, { type: "state" }>;

/** Lands one state reply, keeping each Map whose values are unchanged. */
const applyState = (simulation: SimulationStore, readout: Readout, event: StateEvent): void => {
  const { clock, running } = event;
  const current = simulation.getState();
  const outputs = sameOrNew(current.outputs, unpackOutputs(readout.layout, event.outputs));
  const levels = sameOrNew(current.levels, probeLevels(readout.slots, event.outputs));
  simulation.setState({ outputs, levels, clock, running, error: NO_ERROR });
};

/** The bridge's state: how to read replies, the bits sent, and whether the circuit compiled. */
const createEngineLink = (simulation: SimulationStore, client: EngineClient): EngineLink => {
  // While the circuit cannot be compiled, replies to earlier requests are stale and ignored.
  let invalid = false;
  let readout = EMPTY_READOUT;
  const loaded = createLoadedNetlist();
  const inputs = createInputSender(client);

  const sendInputs = (state: EditorState): void => {
    if (!invalid) {
      inputs.send(readout.layout, state.inputs);
    }
  };

  const fail = (error: SimulationError): void => {
    loaded.forget();
    simulation.setState({ outputs: NO_OUTPUTS, levels: NO_LEVELS, error });
  };

  const reload = (state: EditorState, source: NetlistSource): void => {
    client.send({ type: "load", source, seed: state.history.present.seed });
    inputs.reset();
    sendInputs(state);
  };

  return {
    load: (state) => {
      const flattened = toNetlistSource(state.history.present, state.chipId);
      invalid = !flattened.ok;
      if (!flattened.ok) {
        fail(flattened.error);
        return;
      }
      const probed = withProbes(flattened.value);
      if (loaded.replace(probed.source, flattened.value.layout, state.history.present.seed)) {
        readout = { layout: flattened.value.layout, slots: probed.slots };
        reload(state, probed.source);
      }
    },
    sendInputs,
    onEvent: (event) => {
      if (event.type === "error") {
        fail(event.error);
      } else if (!invalid) {
        applyState(simulation, readout, event);
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
