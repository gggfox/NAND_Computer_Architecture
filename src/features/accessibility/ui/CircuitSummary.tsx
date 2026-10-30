import { useId } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";

import { partOf } from "~/features/circuit-editor";
import type { EditorStore, Level, SimulationStore } from "~/features/circuit-editor";
import type { ChipInstance } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { Switch } from "~/shared/ui";

import styles from "./CircuitSummary.module.css";

interface CircuitSummaryProps {
  readonly editor: EditorStore;
  readonly simulation: SimulationStore;
}

interface Entry {
  readonly instance: ChipInstance;
  readonly part: string;
  /** Index among parts of the same kind: the engine's input/output index. */
  readonly ordinal: number;
}

const toEntries = (instances: readonly ChipInstance[]): readonly Entry[] => {
  const seen = new Map<string, number>();
  return instances.map((instance) => {
    const part = partOf(instance);
    const ordinal = seen.get(part) ?? 0;
    seen.set(part, ordinal + 1);
    return { instance, part, ordinal };
  });
};

const inputLabel = (ordinal: number): string => {
  if (ordinal === 0) {
    return m.input_a();
  }
  if (ordinal === 1) {
    return m.input_b();
  }
  return m.input_named({ name: String.fromCodePoint("A".codePointAt(0)! + ordinal) });
};

const outputLabel = (ordinal: number): string =>
  ordinal === 0 ? m.output() : m.output_numbered({ number: ordinal + 1 });

const outputText = (ordinal: number, level: Level | undefined): string => {
  const label = outputLabel(ordinal);
  return level === undefined
    ? m.output_unknown({ label })
    : m.output_value({ label, value: level });
};

const otherLabel = (entry: Entry): string =>
  entry.part === "nand"
    ? m.nand_numbered({ number: entry.ordinal + 1 })
    : m.part_unsupported({ number: entry.ordinal + 1 });

/**
 * The non-canvas view of the circuit (ADR 3): every part as a list item, inputs as switches
 * that go through the store, and outputs announced politely when the engine reports them.
 */
export function CircuitSummary({ editor, simulation }: CircuitSummaryProps): ReactNode {
  const instances = useStore(editor, (state) => state.history.present.rootCircuit.instances);
  const inputs = useStore(editor, (state) => state.inputs);
  const outputs = useStore(simulation, (state) => state.outputs);
  const headingId = useId();

  const renderEntry = (entry: Entry): ReactNode => {
    if (entry.part === "input") {
      return (
        <Switch
          isSelected={inputs[entry.ordinal] === 1}
          onChange={(isSelected) => {
            editor.getState().setInput(entry.ordinal, isSelected ? 1 : 0);
          }}
        >
          {inputLabel(entry.ordinal)}
        </Switch>
      );
    }
    if (entry.part === "output") {
      return (
        <output className={styles.output} aria-live="polite">
          {outputText(entry.ordinal, outputs[entry.ordinal])}
        </output>
      );
    }
    return <span>{otherLabel(entry)}</span>;
  };

  return (
    <section className={styles.summary} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        {m.summary_heading()}
      </h2>
      <ul className={styles.list}>
        {toEntries(instances).map((entry) => (
          <li key={entry.instance.id} className={styles.item}>
            {renderEntry(entry)}
          </li>
        ))}
      </ul>
    </section>
  );
}
