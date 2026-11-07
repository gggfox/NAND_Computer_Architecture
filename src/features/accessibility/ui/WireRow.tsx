import type { ReactNode } from "react";

import type { WireEntry } from "~/features/circuit-editor";

import { WireActions } from "./WireActions";

import styles from "./StructureView.module.css";

interface WireRowProps {
  readonly wire: WireEntry;
}

/** One wire, worded as the canvas words it. */
export function WireRow({ wire }: WireRowProps): ReactNode {
  return (
    <li className={styles.item}>
      <span>{wire.label}</span>
      <WireActions wire={wire} />
    </li>
  );
}
