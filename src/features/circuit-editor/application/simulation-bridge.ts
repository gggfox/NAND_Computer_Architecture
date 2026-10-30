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
const needsReload = (state: EditorState, previous: EditorState): boolean =>
  state.history.present !== previous.history.present || state.chipId !== previous.chipId;

interface EngineLink {
  /** Flattens the open chip and loads it, then replays every input bit. */
  readonly load: (state: EditorState) => void;
  /** Sends the input bits that changed since the last load or send. */
  readonly sendInputs: (state: EditorState) => void;
  readonly onEvent: (event: EngineEvent) => void;
}

/** The bridge's state: the open chip's I/O layout, the bits sent, and whether it compiled. */
const createEngineLink = (simulation: SimulationStore, client: EngineClient): EngineLink => {
  // While the circuit cannot be compiled, replies to earlier requests are stale and ignored.
  let invalid = false;
  let layout = EMPTY_LAYOUT;
  let sentBits: readonly Level[] = [];

  const sendInputs = (state: EditorState): void => {
    if (invalid) {
      return;
    }
    const bits = packInputs(layout, state.inputs);
    for (const [index, value] of bits.entries()) {
      if (sentBits[index] !== value) {
        client.send({ type: "setInput", index, value });
      }
    }
    sentBits = bits;
  };

  return {
    load: (state) => {
      const flattened = toNetlistSource(state.history.present, state.chipId);
      invalid = !flattened.ok;
      if (!flattened.ok) {
        simulation.setState({ outputs: NO_OUTPUTS, error: flattened.error });
        return;
      }
      ({ layout } = flattened.value);
      const { seed } = state.history.present;
      client.send({ type: "load", source: flattened.value.source, seed });
      sentBits = [];
      sendInputs(state);
    },
    sendInputs,
    onEvent: (event) => {
      if (event.type === "error") {
        simulation.setState({ outputs: NO_OUTPUTS, error: event.error });
      } else if (!invalid) {
        const { clock, running } = event;
        const outputs = unpackOutputs(layout, event.outputs);
        simulation.setState({ outputs, clock, running, error: NO_ERROR });
      }
    },
  };
};

/**
 * Keeps the engine in step with the editor: every project or open-chip change reloads the
 * netlist (then replays the input bits), every input change is forwarded bit by bit, and every
 * engine reply lands in `simulation`. A reload never pauses: the engine keeps its run state.
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
    if (needsReload(state, previous)) {
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
