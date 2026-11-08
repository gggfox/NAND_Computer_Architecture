import type { ReactNode } from "react";
import { useStore } from "zustand";

import type { Ghost, InteractionCommand, Structure } from "~/features/circuit-editor";
import type { PinRef } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { Button } from "~/shared/ui";

import { useStructureSession } from "./structure-session";
import { focusRowWhenReady, SUGGEST_KEY, useRowFocus } from "./use-row-focus";

import styles from "./StructureView.module.css";

/** "{pin} of {part}" for a ghost end, as the wire rows say it. A bit tap adds its bit. */
export const ghostEndText = (structure: Structure, end: PinRef): string => {
  const part = structure.parts.find((item) => item.instanceId === end.instanceId);
  const pin = part?.pins.find((item) => item.ref.pin === end.pin);
  if (part === undefined || pin === undefined) {
    return "";
  }
  return m.canvas_wire_end({
    pin: end.bit === undefined ? pin.name : `${pin.name} ${m.structure_bit({ bit: end.bit })}`,
    chip: part.label,
  });
};

const refKey = ({ instanceId, pin, bit }: PinRef): string =>
  `${instanceId}/${String(pin)}/${String(bit)}`;

interface GhostRowProps {
  readonly from: string;
  readonly to: string;
  readonly onAccept: () => void;
}

/** One ghost as "{from} to {to}" with its Accept button. */
function GhostRow({ from, to, onAccept }: GhostRowProps): ReactNode {
  const { register, prepareRemoval } = useRowFocus(`ghost:${from}>${to}`, SUGGEST_KEY);
  return (
    <li className={styles.item}>
      <span>{m.suggested_row({ from, to })}</span>
      <Button
        ref={register}
        aria-label={m.suggested_accept_label({ from, to })}
        onPress={() => {
          prepareRemoval();
          onAccept();
        }}
      >
        {m.suggested_accept()}
      </Button>
    </li>
  );
}

export interface SuggestedRowsProps {
  readonly structure: Structure;
  readonly ghosts: readonly Ghost[];
  readonly send: (command: InteractionCommand) => void;
}

/**
 * The suggested wires as a list. Each ghost is a row with an Accept button. Accept all and
 * Dismiss act on every ghost. It reads only its props.
 */
export function SuggestedRows({ structure, ghosts, send }: SuggestedRowsProps): ReactNode {
  return (
    <section className={styles.suggested} aria-labelledby="circuit-suggested-heading">
      <h3 id="circuit-suggested-heading" className={styles.subheading}>
        {m.suggestions_bar_count({ count: ghosts.length })}
      </h3>
      <div className={styles.actions}>
        <Button
          onPress={() => {
            send({ type: "acceptAllGhosts" });
            focusRowWhenReady(SUGGEST_KEY);
          }}
        >
          {m.suggestions_accept_all()}
        </Button>
        <Button
          variant="quiet"
          onPress={() => {
            send({ type: "dismissGhosts" });
            focusRowWhenReady(SUGGEST_KEY);
          }}
        >
          {m.suggestions_dismiss()}
        </Button>
      </div>
      <ul className={styles.list}>
        {ghosts.map((ghost, index) => (
          <GhostRow
            key={`${refKey(ghost.from)}>${refKey(ghost.to)}`}
            from={ghostEndText(structure, ghost.from)}
            to={ghostEndText(structure, ghost.to)}
            onAccept={() => {
              send({ type: "acceptGhost", index });
            }}
          />
        ))}
      </ul>
    </section>
  );
}

export interface SuggestedListProps {
  readonly structure: Structure;
}

/**
 * The suggested wires, shown only while ghosts exist. It follows `InteractionState.suggestions`,
 * so any edit clears it.
 */
export function SuggestedList({ structure }: SuggestedListProps): ReactNode {
  const { interaction } = useStructureSession();
  const ghosts = useStore(interaction.store, (state) => state.suggestions?.ghosts);
  if (ghosts === undefined || ghosts.length === 0) {
    return undefined;
  }
  return (
    <SuggestedRows
      structure={structure}
      ghosts={ghosts}
      send={(command) => {
        interaction.store.getState().send({ type: "command", command });
      }}
    />
  );
}
