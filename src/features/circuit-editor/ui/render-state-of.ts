import type { PinRef, Point } from "~/features/projects";

import type { OverlayView } from "../adapters/draw-overlays";
import type { MinimapState } from "../adapters/minimap-renderer";
import type { RenderState } from "../adapters/render-state";
import type { EditorSession } from "../application/editor-session";
import { pinPosition } from "../domain/geometry";
import type { Scene } from "../domain/geometry";
import { previewOf } from "../domain/interaction";
import type { InteractionState } from "../domain/interaction";
import { pinLevelKey } from "../domain/signals";

type Wiring = Pick<OverlayView, "armed" | "wireDrag" | "bends">;

/** Where a wire end attaches now; `undefined` when its instance or pin is gone. */
const anchorOf = (scene: Scene, end: PinRef): Point | undefined => {
  const instance = scene.circuit.instances.find((item) => item.id === end.instanceId);
  return instance && pinPosition(scene, instance, end.pin);
};

const armedOf = (scene: Scene, { armed }: InteractionState): Wiring => {
  const end = armed && anchorOf(scene, armed.end);
  if (armed === undefined || end === undefined) {
    return {};
  }
  const key = pinLevelKey(armed.end.instanceId, armed.end.pin);
  return { armed: { end, key, legal: armed.legal } };
};

/** The wire being dragged out of a pin, from that pin's anchor to the pointer. */
const wireDragOf = (scene: Scene, { drag }: InteractionState): Wiring => {
  const from = drag?.kind === "wire" ? anchorOf(scene, drag.from) : undefined;
  if (drag?.kind !== "wire" || from === undefined) {
    return {};
  }
  const color = drag.color === undefined ? {} : { color: drag.color };
  return { wireDrag: { from, to: drag.point, ...color } };
};

/** Bend mode, with the segment drag on its wire when one is in progress. */
const bendsOf = ({ bends, drag }: InteractionState): Wiring => {
  if (bends === undefined) {
    return {};
  }
  const { wireId, segment } = bends;
  return drag?.kind === "segment" && drag.wireId === wireId
    ? { bends: { wireId, segment, drag: { index: drag.index, offset: drag.offset } } }
    : { bends: { wireId, segment } };
};

/** Everything the renderer reads for one frame. */
export const renderStateOf = (session: EditorSession): RenderState => {
  const { editor, simulation, interaction } = session;
  const editorState = editor.getState();
  const scene = interaction.sceneOf(editorState);
  const state = interaction.store.getState();
  const { outputs, levels } = simulation.getState();
  const marquee =
    state.drag?.kind === "marquee"
      ? { shape: state.drag.shape, points: state.drag.points }
      : undefined;
  return {
    project: scene.project,
    circuit: scene.circuit,
    inputs: editorState.inputs,
    outputs,
    levels,
    view: state.camera,
    scope: editorState.chipId,
    overlay: {
      selection: state.selection,
      positions: previewOf(state, scene.circuit),
      ...(state.hover === undefined ? {} : { hover: state.hover }),
      ...(marquee === undefined ? {} : { marquee }),
      ...armedOf(scene, state),
      ...wireDragOf(scene, state),
      ...bendsOf(state),
    },
  };
};

/** What the minimap reads for one frame. */
export const minimapStateOf = (session: EditorSession, canvas: HTMLCanvasElement): MinimapState => {
  const { editor, interaction } = session;
  const scene = interaction.sceneOf(editor.getState());
  const state = interaction.store.getState();
  return {
    project: scene.project,
    circuit: scene.circuit,
    layout: interaction.layout,
    positions: previewOf(state, scene.circuit),
    view: state.camera,
    viewport: { width: canvas.clientWidth, height: canvas.clientHeight },
    dragging: state.drag !== undefined,
  };
};
