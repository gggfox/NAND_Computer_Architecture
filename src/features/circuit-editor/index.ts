export { EditorSearchSchema, startingChipId, type EditorSearch } from "./domain/view-search";
export type { EditorAction, EditorError, PlaceableKind } from "./domain/actions";
export { createHistory, pushHistory, redo, undo, type History } from "./domain/history";
export type { Trail } from "./domain/breadcrumbs";
export { editorErrorMessage } from "./domain/editor-error-messages";
export { applyAction } from "./domain/reducer";
export { savePreview, type SaveConsequence, type SavePreview } from "./domain/save-preview";
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
export type { OutputReading } from "./domain/view-command-types";
export {
  structureOf,
  type PartEntry,
  type PinEntry,
  type Structure,
  type WireEntry,
} from "./domain/structure";
export { wireTargets, type WireTarget } from "./domain/wire-targets-list";
export type { Level } from "./domain/signals";
export {
  connectSimulation,
  createSimulationStore,
  type ClockControls,
  type SimulationConnection,
  type SimulationState,
  type SimulationStore,
} from "./application/simulation-bridge";
export { cameraForUrl, type Camera } from "./domain/camera";
export { CircuitCanvas } from "./ui/CircuitCanvas";
export { EditorLayout } from "./ui/EditorLayout";
export { ChipHeader, type FirstSaveContext, type FirstSaveSlot } from "./ui/ChipHeader";
export { EditorPreferences } from "./ui/EditorPreferences";
export { EditorToolbar } from "./ui/EditorToolbar";
export { PinsPanel } from "./ui/PinsPanel";
export { createEditorSession, type EditorSession } from "./application/editor-session";
export { useEditorSession } from "./ui/use-editor-session";
export { useSessionErrors } from "./ui/use-session-errors";
export {
  addPinAtCentre,
  armPlacement,
  cancelPlacement,
  placeAtCentre,
  placeAtClient,
  usePlacing,
  useRecentPlacements,
  type CanvasMenuContext,
} from "./application/library-bridge";
export {
  chipSwatches,
  DialogActions,
  DialogForm,
  RecolorChipDialog,
  RenameChipDialog,
} from "./ui/ChipDialogs";
export type { InteractionCommand } from "./domain/interaction";
export type { Ghost } from "./domain/suggestion-types";
export { WireColorDialog } from "./ui/WireDialogs";
