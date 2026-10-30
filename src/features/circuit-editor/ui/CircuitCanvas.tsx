import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { createCanvasRenderer } from "../adapters/canvas-renderer";
import type { CanvasRenderer } from "../adapters/canvas-renderer";
import { openCircuit } from "../application/editor-store";
import type { EditorStore } from "../application/editor-store";
import type { SimulationStore } from "../application/simulation-bridge";
import type { EditorSearch } from "../domain/view-search";

import styles from "./CircuitCanvas.module.css";

/** The canvas ref is always set after mount; this only satisfies the effect's return type. */
const noCleanup = (): void => {
  // Nothing was started.
};

interface CircuitCanvasProps {
  readonly editor: EditorStore;
  readonly simulation: SimulationStore;
  readonly view: EditorSearch;
}

/**
 * Hosts the canvas renderer. It never re-renders on store changes: the renderer reads the stores
 * with `getState()` and redraws when their `subscribe` callbacks fire. Only a view (URL) change
 * re-renders this component, which just forwards the new view and asks for one redraw.
 * The canvas is hidden from assistive technology: the circuit summary is its accessible twin.
 */
export function CircuitCanvas({ editor, simulation, view }: CircuitCanvasProps): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef(view);
  const rendererRef = useRef<CanvasRenderer | undefined>(undefined);

  useEffect(() => {
    viewRef.current = view;
    rendererRef.current?.invalidate();
  }, [view]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return noCleanup;
    }
    const renderer = createCanvasRenderer(canvas, () => {
      const state = editor.getState();
      const { outputs, levels } = simulation.getState();
      return {
        project: state.history.present,
        circuit: openCircuit(state),
        inputs: state.inputs,
        outputs,
        levels,
        view: viewRef.current,
      };
    });
    rendererRef.current = renderer;
    renderer.start();
    const unsubscribeEditor = editor.subscribe(renderer.invalidate);
    const unsubscribeSimulation = simulation.subscribe(renderer.invalidate);
    return () => {
      unsubscribeEditor();
      unsubscribeSimulation();
      renderer.stop();
      rendererRef.current = undefined;
    };
  }, [editor, simulation]);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}
