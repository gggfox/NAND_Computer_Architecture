import type { CSSProperties, ReactNode } from "react";
import { useStore } from "zustand";

import type { Point } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { Button, Toolbar } from "~/shared/ui";

import type { EditorSession } from "../application/editor-session";
import type { InteractionCommand } from "../domain/interaction";
import { piecesBounds } from "../domain/pieces-bounds";
import { barPlacement, barVisible } from "../domain/selection-bar";

import styles from "./SelectionBar.module.css";

const ACTIONS: readonly (readonly [InteractionCommand, () => string])[] = [
  [{ type: "duplicate" }, () => m.selection_bar_duplicate()],
  [{ type: "showArray" }, () => m.selection_bar_array()],
  [{ type: "deleteSelection" }, () => m.delete_selection()],
];

function BarButtons({ session }: { readonly session: EditorSession }): ReactNode {
  return (
    <Toolbar aria-label={m.selection_bar_label()}>
      {ACTIONS.map(([command, label]) => (
        <Button
          key={command.type}
          variant="quiet"
          onPress={() => {
            session.interaction.store.getState().send({ type: "command", command });
          }}
        >
          {label()}
        </Button>
      ))}
    </Toolbar>
  );
}

/** Room the bar needs: half its width across, and its height down (it never wraps). */
const HALF_WIDTH = "8rem";
const HEIGHT = "3rem";
const EDGE = "0.5rem";

/**
 * The bar at `point`, kept inside the canvas when the selection runs past an edge. Above, the
 * point is the bar's centre-bottom; below, its centre-top (see the translates in the CSS).
 */
const insideCanvas = (point: Point, side: "above" | "below"): CSSProperties => ({
  insetInlineStart: `clamp(${HALF_WIDTH}, ${point.x}px, calc(100% - ${HALF_WIDTH}))`,
  insetBlockStart:
    side === "above"
      ? `clamp(${HEIGHT}, ${point.y}px, calc(100% - ${EDGE}))`
      : `clamp(${EDGE}, ${point.y}px, calc(100% - ${HEIGHT}))`,
});

/**
 * Duplicate, Array… and Delete over the selected chips, for touch and mouse users who do not
 * know the shortcuts. It follows the selection and flips below it near the canvas top.
 */
export function SelectionBar({ session }: { readonly session: EditorSession }): ReactNode {
  const state = useStore(session.interaction.store);
  const editor = useStore(session.editor);
  const scene = session.interaction.sceneOf(editor);
  const chosen = scene.circuit.instances.filter((item) => state.selection.instances.has(item.id));
  const bounds = barVisible(state) ? piecesBounds(scene, chosen) : undefined;
  if (bounds === undefined) {
    return undefined;
  }
  const { point, side } = barPlacement(bounds, state.camera);
  return (
    <div className={styles.dock}>
      <div
        className={side === "below" ? `${styles.bar} ${styles.below}` : styles.bar}
        style={insideCanvas(point, side)}
      >
        <BarButtons session={session} />
      </div>
    </div>
  );
}
