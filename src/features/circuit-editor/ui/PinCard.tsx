import type { ReactNode } from "react";
import { useStore } from "zustand";

import { m } from "~/i18n/paraglide/messages";

import type { EditorSession } from "../application/editor-session";
import type { PinCard as PinCardState } from "../domain/interaction";
import { bitsText, pinInfo } from "../domain/pin-info";

import styles from "./PinCard.module.css";

/** Keeps the card inside a 360 px-wide phone canvas: it opens left of pins near the right edge. */
const FLIP_AFTER_PX = 200;

/**
 * What a pin is (spec §5.1): name, width, live value and connections. Visual only: the same words
 * reach screen readers through the canvas's live region when the card opens.
 */
export function PinCard({
  session,
  card,
}: {
  readonly session: EditorSession;
  readonly card: PinCardState;
}): ReactNode {
  const levels = useStore(session.simulation, (state) => state.levels);
  const editor = useStore(session.editor);
  const known = { inputs: editor.inputs, outputs: session.simulation.getState().outputs, levels };
  const info = pinInfo(session.interaction.sceneOf(editor), known, [card.instanceId, card.pin]);
  if (info === undefined) {
    return undefined;
  }
  const flip = card.screen.x > FLIP_AFTER_PX;
  return (
    <div
      className={`${styles.card} ${flip ? styles.flipped : ""}`}
      style={{ insetInlineStart: card.screen.x, insetBlockStart: card.screen.y }}
      aria-hidden="true"
    >
      <p className={styles.name}>
        {info.name}
        <span className={styles.width}>
          {info.width === 1 ? m.pin_card_width_one() : m.pin_card_width({ width: info.width })}
        </span>
      </p>
      <p>{m.pin_card_value({ value: info.valueText })}</p>
      {info.width > 1 && info.usedBits.length > 0 ? (
        <p>{m.pin_card_bits_used({ bits: bitsText(info.usedBits) })}</p>
      ) : undefined}
      <ul className={styles.connections}>
        {info.connections.length === 0 ? <li>{m.pin_card_unconnected()}</li> : undefined}
        {info.connections.map((connection) => (
          <li key={`${connection.chip}.${connection.pin}`}>{m.pin_card_connection(connection)}</li>
        ))}
      </ul>
    </div>
  );
}
