import { useMemo, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { useStore } from "zustand";

import { openCircuit, structureOf } from "~/features/circuit-editor";
import type { EditorSession, PartEntry, Structure } from "~/features/circuit-editor";
import { m } from "~/i18n/paraglide/messages";
import type { InstanceId, PinId } from "~/shared/ids";

import { PartRow } from "./PartRow";
import { StructureSessionContext } from "./structure-session";
import { StructureActions } from "./StructureActions";
import { WireRow } from "./WireRow";

import styles from "./StructureView.module.css";

/** The heading is the skip link's target. A page has one structure view. */
const HEADING_ID = "circuit-structure-heading";

const focusHeading = (event: MouseEvent): void => {
  event.preventDefault();
  document.querySelector<HTMLElement>(`#${HEADING_ID}`)?.focus();
};

/** The first stop in the page: hidden until it has focus. It moves focus to the structure. */
export function StructureSkipLink(): ReactNode {
  return (
    <a className={styles.skip} href={`#${HEADING_ID}`} onClick={focusHeading}>
      {m.structure_skip()}
    </a>
  );
}

export interface StructureBodyProps {
  readonly structure: Structure;
  /** Input values by pin. */
  readonly inputs: ReadonlyMap<PinId, number>;
  /** Output values by pin. */
  readonly outputs: ReadonlyMap<PinId, number>;
  /** Pin names by pin, for the output texts. */
  readonly pinNames: ReadonlyMap<PinId, string>;
  readonly selected: ReadonlySet<InstanceId>;
  /** The parts whose pins are shown. */
  readonly expanded: ReadonlySet<InstanceId>;
  readonly onToggle: (id: InstanceId) => void;
  readonly onSetInput: (pinId: PinId, value: number) => void;
}

const outputText = (name: string, value: number | undefined): string =>
  value === undefined ? m.output_named_unknown({ name }) : m.output_named_value({ name, value });

/** The structure as a region with Parts and Wires. It reads only its props. */
export function StructureBody(props: StructureBodyProps): ReactNode {
  const { structure, inputs, outputs, pinNames, selected, expanded, onToggle, onSetInput } = props;
  const row = (part: PartEntry): ReactNode => {
    const { pinId } = part;
    return (
      <PartRow
        key={part.instanceId}
        part={part}
        isSelected={selected.has(part.instanceId)}
        isExpanded={expanded.has(part.instanceId)}
        isOn={pinId !== undefined && inputs.get(pinId) === 1}
        outputText={
          pinId === undefined ? "" : outputText(pinNames.get(pinId) ?? "", outputs.get(pinId))
        }
        onToggle={() => {
          onToggle(part.instanceId);
        }}
        onSetInput={(isOn) => {
          if (pinId !== undefined) {
            onSetInput(pinId, isOn ? 1 : 0);
          }
        }}
      />
    );
  };
  return (
    <section className={styles.structure} aria-labelledby={HEADING_ID}>
      <h2 id={HEADING_ID} className={styles.heading} tabIndex={-1}>
        {m.structure_heading()}
      </h2>
      <StructureActions structure={structure} />
      <h3 className={styles.subheading}>{m.structure_parts()}</h3>
      <ul className={styles.list}>{structure.parts.map((part) => row(part))}</ul>
      <h3 className={styles.subheading}>{m.structure_wires()}</h3>
      <ul className={styles.list}>
        {structure.wires.map((wire) => (
          <WireRow key={wire.wireId} wire={wire} />
        ))}
      </ul>
    </section>
  );
}

interface StructureViewProps {
  readonly session: EditorSession;
}

const toggled = (set: ReadonlySet<InstanceId>, id: InstanceId): ReadonlySet<InstanceId> => {
  const next = new Set(set);
  if (!next.delete(id)) {
    next.add(id);
  }
  return next;
};

/**
 * The non-canvas view of the circuit (ADR 3): every part with its pins and every wire. Inputs
 * are switches that go through the store. Outputs are polite live values. Which parts show their
 * pins is view state: it is not saved and not part of the history. It provides the session to
 * the action menus through `StructureSessionContext`.
 */
export function StructureView({ session }: StructureViewProps): ReactNode {
  const { editor, simulation, interaction } = session;
  const project = useStore(editor, (state) => state.history.present);
  const circuit = useStore(editor, openCircuit);
  const inputs = useStore(editor, (state) => state.inputs);
  const outputs = useStore(simulation, (state) => state.outputs);
  const selected = useStore(interaction.store, (state) => state.selection.instances);
  const [expanded, setExpanded] = useState<ReadonlySet<InstanceId>>(new Set());
  const structure = useMemo(() => structureOf({ project, circuit }), [project, circuit]);
  const pinNames = useMemo(() => new Map(circuit.pins.map((pin) => [pin.id, pin.name])), [circuit]);
  return (
    <StructureSessionContext value={session}>
      <StructureBody
        structure={structure}
        inputs={inputs}
        outputs={outputs}
        pinNames={pinNames}
        selected={selected}
        expanded={expanded}
        onToggle={(id) => {
          setExpanded((current) => toggled(current, id));
        }}
        onSetInput={(pinId, value) => {
          editor.getState().setInput(pinId, value);
        }}
      />
    </StructureSessionContext>
  );
}
