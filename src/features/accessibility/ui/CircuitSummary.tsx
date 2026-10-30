import { useId } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";

import { openCircuit, partName, partOf } from "~/features/circuit-editor";
import type { EditorStore, Part, SimulationStore } from "~/features/circuit-editor";
import type { ChipInstance, Circuit, PinDirection, Project } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import type { PinId } from "~/shared/ids";
import { Switch } from "~/shared/ui";

import styles from "./CircuitSummary.module.css";

interface CircuitSummaryProps {
  readonly editor: EditorStore;
  readonly simulation: SimulationStore;
}

interface PinEntry<Direction extends PinDirection> {
  readonly instance: ChipInstance;
  readonly part: Direction;
  readonly pinId: PinId;
  /** Position among the pins of the same direction, in Pins-panel order. */
  readonly ordinal: number;
}

type Entry =
  | PinEntry<"input">
  | PinEntry<"output">
  | {
      readonly instance: ChipInstance;
      readonly part: Exclude<Part, "input" | "output">;
      readonly name: string;
      /** 1-based count among parts with the same name, in canvas order. */
      readonly number: number;
    };

const pinOrdinal = (circuit: Circuit, direction: PinDirection, pinId: PinId): number =>
  circuit.pins.filter((pin) => pin.direction === direction).findIndex((pin) => pin.id === pinId);

const toEntries = (project: Project, circuit: Circuit): readonly Entry[] => {
  const seen = new Map<string, number>();
  return circuit.instances.map((instance): Entry => {
    const part = partOf(circuit, instance);
    const { kind } = instance;
    if (kind.type === "pin") {
      const direction = part === "output" ? "output" : "input";
      const ordinal = pinOrdinal(circuit, direction, kind.pinId);
      return { instance, part: direction, pinId: kind.pinId, ordinal };
    }
    const name = partName(project, circuit, kind);
    const number = (seen.get(name) ?? 0) + 1;
    seen.set(name, number);
    return { instance, part: kind.type, name, number };
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

const outputText = (ordinal: number, value: number | undefined): string => {
  const label = outputLabel(ordinal);
  return value === undefined ? m.output_unknown({ label }) : m.output_value({ label, value });
};

const otherLabel = (name: string, number: number, isNand: boolean): string =>
  isNand ? m.nand_numbered({ number }) : m.part_numbered({ name, number });

/**
 * The non-canvas view of the circuit (ADR 3): every part as a list item, inputs as switches
 * that go through the store, and outputs announced politely when the engine reports them.
 */
export function CircuitSummary({ editor, simulation }: CircuitSummaryProps): ReactNode {
  const project = useStore(editor, (state) => state.history.present);
  const circuit = useStore(editor, openCircuit);
  const inputs = useStore(editor, (state) => state.inputs);
  const outputs = useStore(simulation, (state) => state.outputs);
  const headingId = useId();

  const renderEntry = (entry: Entry): ReactNode => {
    if (entry.part === "input") {
      const { pinId } = entry;
      return (
        <Switch
          isSelected={inputs.get(pinId) === 1}
          onChange={(isSelected) => {
            editor.getState().setInput(pinId, isSelected ? 1 : 0);
          }}
        >
          {inputLabel(entry.ordinal)}
        </Switch>
      );
    }
    if (entry.part === "output") {
      return (
        <output className={styles.output} aria-live="polite">
          {outputText(entry.ordinal, outputs.get(entry.pinId))}
        </output>
      );
    }
    const { name, number, part } = entry;
    return <span>{otherLabel(name, number, part === "nand")}</span>;
  };

  return (
    <section className={styles.summary} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        {m.summary_heading()}
      </h2>
      <ul className={styles.list}>
        {toEntries(project, circuit).map((entry) => (
          <li key={entry.instance.id} className={styles.item}>
            {renderEntry(entry)}
          </li>
        ))}
      </ul>
    </section>
  );
}
