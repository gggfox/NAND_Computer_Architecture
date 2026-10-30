import { useId } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";

import { findChip } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";

import type { EditorSession } from "../application/editor-session";
import type { EditorSearch } from "../domain/view-search";
import { CanvasOverlays } from "./CanvasOverlays";
import { useCanvas, useSpoken, useUrlCamera } from "./use-canvas";

import styles from "./CircuitCanvas.module.css";

interface CircuitCanvasProps {
  readonly session: EditorSession;
  /** The URL's camera: followed when it changes from outside (back/forward, a pasted link). */
  readonly view: EditorSearch;
}

/**
 * The editing surface (ADR 3, 20, 21). The `<canvas>` is drawn outside React and hidden from
 * assistive technology; the focusable host around it takes the keyboard map, describes it, and
 * speaks each selection, move, delete and pin through a polite live region. Tab always leaves.
 */
export function CircuitCanvas({ session, view }: CircuitCanvasProps): ReactNode {
  const { canvasRef, onKeyDown, onKeyUp, onBlur } = useCanvas(session);
  useUrlCamera(session, view);
  const spoken = useSpoken(session);
  const hintId = useId();
  const chipName = useStore(
    session.editor,
    (state) => findChip(state.history.present, state.chipId)?.name ?? "",
  );

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- `application` is an interactive role: the host takes the canvas's keyboard map
    <div
      className={styles.host}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the application region is the canvas's one focus stop
      tabIndex={0}
      role="application"
      aria-roledescription={m.canvas_roledescription()}
      aria-label={chipName}
      aria-describedby={hintId}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={onBlur}
    >
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <p id={hintId} className="visually-hidden">
        {m.canvas_hint()}
      </p>
      <p className="visually-hidden" aria-live="polite">
        {spoken}
      </p>
      <CanvasOverlays session={session} />
    </div>
  );
}
