import type { ReactNode } from "react";

import type { PinEntry } from "~/features/circuit-editor";
import { m } from "~/i18n/paraglide/messages";

import { PinActions } from "./PinActions";

import styles from "./StructureView.module.css";

interface PinRowProps {
  readonly pin: PinEntry;
}

const pinText = ({ name, direction, width, connections }: PinEntry): string =>
  m.structure_pin_summary({
    name,
    direction: direction === "input" ? m.structure_pin_input() : m.structure_pin_output(),
    width,
    connections: connections.length === 0 ? m.structure_not_connected() : connections.join("; "),
  });

/** One pin of a part: name, direction, width and what it connects to. */
export function PinRow({ pin }: PinRowProps): ReactNode {
  return (
    <li className={styles.item}>
      <span>{pinText(pin)}</span>
      <PinActions pin={pin} />
    </li>
  );
}
