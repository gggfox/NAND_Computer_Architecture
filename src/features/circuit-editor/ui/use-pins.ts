import { useStore } from "zustand";

import type { PinId } from "~/shared/ids";

import type { EditorSession } from "../application/editor-session";
import { openCircuit } from "../application/editor-store";
import { pinRows } from "../domain/pin-rows";
import type { PinRows } from "../domain/pin-rows";

export interface PinsView {
  readonly rows: PinRows;
  /** Input levels the user set. */
  readonly inputs: ReadonlyMap<PinId, number>;
  /** Output values the engine reported. */
  readonly outputs: ReadonlyMap<PinId, number>;
}

/** The Pins panel's rows and values, kept current with the editor, canvas and engine. */
export const usePins = (session: EditorSession): PinsView => {
  const circuit = useStore(session.editor, openCircuit);
  const selection = useStore(session.interaction.store, (state) => state.selection.instances);
  const inputs = useStore(session.editor, (state) => state.inputs);
  const outputs = useStore(session.simulation, (state) => state.outputs);
  return { rows: pinRows(circuit, selection), inputs, outputs };
};

/** How many pins the open chip has, for the panel's heading. */
export const usePinCount = (session: EditorSession): number =>
  useStore(session.editor, (state) => openCircuit(state).pins.length);
