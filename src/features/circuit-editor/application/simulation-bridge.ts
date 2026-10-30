import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

import type { EngineClient, EngineEvent } from "~/features/simulation";

import type { SimulationError } from "../domain/messages";
import type { Level } from "../domain/signals";
import { toNetlistSource } from "../domain/to-netlist-source";
import { openCircuit } from "./editor-store";
import type { EditorState, EditorStore } from "./editor-store";

export interface SimulationState {
  /** The engine's last reported outputs; empty until it answers or while the circuit is invalid. */
  readonly outputs: readonly Level[];
  readonly error: SimulationError | null;
}

export type SimulationStore = StoreApi<SimulationState>;

// oxlint-disable-next-line unicorn/no-null -- `null` is the documented "no error" value of the store state
const NO_ERROR: SimulationError | null = null;

export const createSimulationStore = (): SimulationStore =>
  createStore<SimulationState>(() => ({ outputs: [], error: NO_ERROR }));

/**
 * Keeps the engine in step with the editor: every circuit change reloads the netlist (then
 * replays the current inputs), every input change is forwarded, and every engine reply lands in
 * `simulation`. Returns the function that disconnects it; the caller owns and disposes `client`.
 */
export const connectSimulation = (
  editor: EditorStore,
  simulation: SimulationStore,
  client: EngineClient,
): (() => void) => {
  // While the circuit cannot be compiled, replies to earlier requests are stale and ignored.
  let invalid = false;

  const sendInputs = (inputs: readonly Level[], previous: readonly Level[] = []): void => {
    for (const [index, value] of inputs.entries()) {
      if (previous[index] !== value) {
        client.send({ type: "setInput", index, value });
      }
    }
  };

  const load = (state: EditorState): void => {
    const flattened = toNetlistSource(state.history.present, state.chipId);
    invalid = !flattened.ok;
    if (!flattened.ok) {
      simulation.setState({ outputs: [], error: flattened.error });
      return;
    }
    client.send({ type: "load", source: flattened.value.source, seed: state.history.present.seed });
    sendInputs(state.inputs);
  };

  const onEvent = (event: EngineEvent): void => {
    if (event.type === "error") {
      simulation.setState({ outputs: [], error: event.error });
    } else if (!invalid) {
      simulation.setState({ outputs: event.outputs, error: NO_ERROR });
    }
  };

  const unsubscribeEngine = client.subscribe(onEvent);
  const unsubscribeEditor = editor.subscribe((state, previous) => {
    if (openCircuit(state) !== openCircuit(previous)) {
      load(state);
    } else if (state.inputs !== previous.inputs && !invalid) {
      sendInputs(state.inputs, previous.inputs);
    }
  });
  load(editor.getState());

  return () => {
    unsubscribeEditor();
    unsubscribeEngine();
  };
};
