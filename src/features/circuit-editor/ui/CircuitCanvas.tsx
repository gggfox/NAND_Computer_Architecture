import { useId, useRef } from "react";
import type { ReactNode } from "react";

import { m } from "~/i18n/paraglide/messages";

import type { EditorSession } from "../application/editor-session";
import type { EditorSearch } from "../domain/view-search";
import { CanvasOverlays } from "./CanvasOverlays";
import type { CanvasMenuSlot } from "./CanvasOverlays";
import { PlacingBanner } from "./PlacingBanner";
import { useCanvas, useSpoken, useUrlCamera } from "./use-canvas";
import { useChipName } from "./use-chip-name";
import { ZoomCorner } from "./ZoomCorner";

import styles from "./CircuitCanvas.module.css";

interface CircuitCanvasProps {
  readonly session: EditorSession;
  /** The URL's camera: followed when it changes from outside (back/forward, a pasted link). */
  readonly view: EditorSearch;
  /** The canvas menu's content (the library's quick-add); without it, the menu offers Tidy wires. */
  readonly canvasMenu?: CanvasMenuSlot;
}

/**
 * The editing surface (ADR 3, 20, 21). The `<canvas>` is drawn outside React and hidden from
 * assistive technology; the focusable host around it takes the keyboard map, describes it, and
 * speaks each selection, move, delete and pin through a polite live region. Tab always leaves.
 * The minimap in the corner is a pointer shortcut only, so it is hidden from assistive technology.
 * On a narrow screen the zoom controls sit in the top-right corner.
 */
export function CircuitCanvas({ session, view, canvasMenu }: CircuitCanvasProps): ReactNode {
  const { canvasRef, minimapRef, onKeyDown, onKeyUp, onBlur } = useCanvas(session);
  useUrlCamera(session, view);
  const spoken = useSpoken(session);
  const hintId = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const chipName = useChipName(session);

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- `application` is an interactive role: the host takes the canvas's keyboard map
    <div
      ref={hostRef}
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
      <canvas ref={minimapRef} className={styles.minimap} aria-hidden="true" />
      <p id={hintId} className="visually-hidden">
        {m.canvas_hint()}
      </p>
      <p className="visually-hidden" aria-live="polite">
        {spoken}
      </p>
      <ZoomCorner session={session} />
      <PlacingBanner session={session} hostRef={hostRef} />
      <CanvasOverlays session={session} hostRef={hostRef} canvasMenu={canvasMenu} />
    </div>
  );
}
