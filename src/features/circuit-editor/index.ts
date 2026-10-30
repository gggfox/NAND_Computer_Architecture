export { EditorSearchSchema, type EditorSearch } from "./domain/view-search";
export type { EditorAction, EditorError } from "./domain/actions";
export { createHistory, pushHistory, redo, undo, type History } from "./domain/history";
export { editorErrorMessage } from "./domain/editor-error-messages";
export { applyAction } from "./domain/reducer";
export {
  toNetlistSource,
  type Flattened,
  type NetlistSourceError,
} from "./domain/to-netlist-source";
export {
  ioLayout,
  packInputs,
  unpackOutputs,
  type IoLayout,
  type IoSlot,
} from "./domain/io-layout";
export {
  createEditorStore,
  openCircuit,
  type EditorState,
  type EditorStore,
} from "./application/editor-store";
export {
  editorStoreErrorMessage,
  partName,
  simulationErrorMessage,
  type SimulationError,
} from "./domain/messages";
export { partOf, type Part } from "./domain/geometry";
export type { Level } from "./domain/signals";
export {
  connectSimulation,
  createSimulationStore,
  type ClockControls,
  type SimulationConnection,
  type SimulationState,
  type SimulationStore,
} from "./application/simulation-bridge";
export { CircuitCanvas } from "./ui/CircuitCanvas";
export { EditorLayout } from "./ui/EditorLayout";
export { EditorToolbar } from "./ui/EditorToolbar";
export { useEditorSession, type EditorSession } from "./ui/use-editor-session";
