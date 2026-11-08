import type { ReactNode } from "react";

import { m } from "~/i18n/paraglide/messages";

import styles from "./Landing.module.css";

type Bit = 0 | 1;

/** Each row is A, B and OUT: the output is low only when both inputs are high. */
const TRUTH_ROWS: readonly (readonly [Bit, Bit, Bit])[] = [
  [0, 0, 1],
  [0, 1, 1],
  [1, 0, 1],
  [1, 1, 0],
];

/** A NAND gate drawn as a schematic, with signals moving along its input wires. */
function NandSchematic(): ReactNode {
  return (
    <svg className={styles.schematic} viewBox="0 0 320 200" aria-hidden="true">
      <path className={styles.wire} d="M24 70 H120 M24 130 H120" />
      <path className={styles.live} d="M250 100 H296" />
      <rect className={styles.pulse} x="24" y="68" width="16" height="4" />
      <rect className={`${styles.pulse} ${styles.late}`} x="24" y="128" width="16" height="4" />
      <path className={styles.gate} d="M120 40 H170 A60 60 0 0 1 170 160 H120 Z" />
      <circle className={styles.gate} cx="240" cy="100" r="9" />
      <circle className={styles.pin} cx="24" cy="70" r="4" />
      <circle className={styles.pin} cx="24" cy="130" r="4" />
      <circle className={styles.drive} cx="296" cy="100" r="4" />
      <text className={styles.label} x="12" y="58">
        {m.landing_truth_a()}
      </text>
      <text className={styles.label} x="12" y="118">
        {m.landing_truth_b()}
      </text>
      <text className={styles.label} x="268" y="88">
        {m.landing_truth_out()}
      </text>
      <text className={styles.symbol} x="160" y="106">
        {m.landing_step_nand_title()}
      </text>
    </svg>
  );
}

function TruthHead(): ReactNode {
  return (
    <thead>
      <tr>
        <th scope="col">{m.landing_truth_a()}</th>
        <th scope="col">{m.landing_truth_b()}</th>
        <th scope="col">{m.landing_truth_out()}</th>
      </tr>
    </thead>
  );
}

function TruthRow({ row }: { readonly row: readonly [Bit, Bit, Bit] }): ReactNode {
  const [inputA, inputB, output] = row;
  return (
    <tr>
      <td>{inputA}</td>
      <td>{inputB}</td>
      <td className={output === 1 ? styles.high : styles.low}>{output}</td>
    </tr>
  );
}

function TruthTable(): ReactNode {
  return (
    <table className={styles.truth}>
      <caption className="visually-hidden">{m.landing_truth_table()}</caption>
      <TruthHead />
      <tbody>
        {TRUTH_ROWS.map((row) => (
          <TruthRow key={row.join("")} row={row} />
        ))}
      </tbody>
    </table>
  );
}

/** The hero's instrument panel: the one built-in gate and its truth table. */
export function NandPanel(): ReactNode {
  return (
    <figure className={styles.panel}>
      <figcaption className={styles.caption}>{m.landing_panel_label()}</figcaption>
      <NandSchematic />
      <TruthTable />
    </figure>
  );
}
