import { useId } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";

import { openCircuit, partName, partOf } from "~/features/circuit-editor";
import type { EditorSession, Part } from "~/features/circuit-editor";
import type { ChipInstance, Circuit, PinDirection, Project } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import type { PinId } from "~/shared/ids";
import { Switch } from "~/shared/ui";

import styles from "./CircuitSummary.module.css";

interface CircuitSummaryProps {
  readonly session: EditorSession;
}

interface PinEntry<Direction extends PinDirection> {
  readonly instance: ChipInstance;
  readonly part: Direction;
  readonly pinId: PinId;
  /** The pin's own name, from its definition in `circuit.pins`. */
  readonly name: string;
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

const toEntries = (project: Project, circuit: Circuit): readonly Entry[] => {
  const seen = new Map<string, number>();
  return circuit.instances.map((instance): Entry => {
    const part = partOf(circuit, instance);
    const { kind } = instance;
    if (kind.type === "pin") {
      const direction = part === "output" ? "output" : "input";
      const name = circuit.pins.find((pin) => pin.id === kind.pinId)?.name ?? "";
      return { instance, part: direction, pinId: kind.pinId, name };
    }
    const name = partName(project, circuit, kind);
    const number = (seen.get(name) ?? 0) + 1;
    seen.set(name, number);
    return { instance, part: kind.type, name, number };
  });
};

const outputText = (name: string, value: number | undefined): string =>
  value === undefined ? m.output_named_unknown({ name }) : m.output_named_value({ name, value });

const otherLabel = (name: string, number: number, isNand: boolean): string =>
  isNand ? m.nand_numbered({ number }) : m.part_numbered({ name, number });

interface EntryProps {
  readonly entry: Entry;
  readonly editor: EditorSession["editor"];
  readonly inputs: ReadonlyMap<PinId, number>;
  readonly outputs: ReadonlyMap<PinId, number>;
}

/** One part: an input as a switch, an output as a polite live value, anything else by name. */
function EntryControl({ entry, editor, inputs, outputs }: EntryProps): ReactNode {
  if (entry.part === "input") {
    const { pinId } = entry;
    return (
      <Switch
        isSelected={inputs.get(pinId) === 1}
        onChange={(isSelected) => {
          editor.getState().setInput(pinId, isSelected ? 1 : 0);
        }}
      >
        {m.input_named({ name: entry.name })}
      </Switch>
    );
  }
  if (entry.part === "output") {
    return (
      <output className={styles.output} aria-live="polite">
        {outputText(entry.name, outputs.get(entry.pinId))}
      </output>
    );
  }
  const { name, number, part } = entry;
  return <span>{otherLabel(name, number, part === "nand")}</span>;
}

/**
 * The non-canvas view of the circuit (ADR 3): every part as a list item, inputs as switches
 * that go through the store, and outputs announced politely when the engine reports them. A part
 * selected on the canvas says so after its name (Phase 6 builds the full structure).
 */
export function CircuitSummary({ session }: CircuitSummaryProps): ReactNode {
  const { editor, simulation, interaction } = session;
  const project = useStore(editor, (state) => state.history.present);
  const circuit = useStore(editor, openCircuit);
  const inputs = useStore(editor, (state) => state.inputs);
  const outputs = useStore(simulation, (state) => state.outputs);
  const selected = useStore(interaction.store, (state) => state.selection.instances);
  const headingId = useId();

  const renderItem = (entry: Entry): ReactNode => (
    <li key={entry.instance.id} className={styles.item}>
      <EntryControl entry={entry} editor={editor} inputs={inputs} outputs={outputs} />
      {selected.has(entry.instance.id) ? (
        <span className={styles.selected}>{m.summary_selected()}</span>
      ) : undefined}
    </li>
  );

  return (
    <section className={styles.summary} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        {m.summary_heading()}
      </h2>
      <ul className={styles.list}>
        {toEntries(project, circuit).map((entry) => renderItem(entry))}
      </ul>
    </section>
  );
}
