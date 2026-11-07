import type { ReactNode } from "react";
import { useStore } from "zustand";

import type { PartEntry } from "~/features/circuit-editor";
import { m } from "~/i18n/paraglide/messages";
import { Button, Switch } from "~/shared/ui";

import { PartActions } from "./PartActions";
import { PinRow } from "./PinRow";
import { useStructureSession } from "./structure-session";

import styles from "./StructureView.module.css";

export interface PartRowProps {
  readonly part: PartEntry;
  readonly isSelected: boolean;
  readonly isExpanded: boolean;
  /** An input's value: on or off. */
  readonly isOn: boolean;
  /** An output's text, such as `Output OUT: 1`. */
  readonly outputText: string;
  readonly onToggle: () => void;
  readonly onSetInput: (isOn: boolean) => void;
}

/**
 * An output's text. `<output>` has the `status` role, which is a polite live region. While the
 * clock runs, every tick can change a value, so the region is off. "Read outputs" speaks them.
 */
function OutputValue({ text }: { readonly text: string }): ReactNode {
  const { simulation } = useStructureSession();
  const running = useStore(simulation, (state) => state.running);
  return (
    <output className={styles.output} aria-live={running ? "off" : undefined}>
      {text}
    </output>
  );
}

/** An input as a switch, an output as a live value, anything else by its label. */
function PartControl({
  part,
  isOn,
  outputText,
  onSetInput,
}: Pick<PartRowProps, "part" | "isOn" | "outputText" | "onSetInput">): ReactNode {
  if (part.kind === "input") {
    return (
      <Switch isSelected={isOn} onChange={onSetInput}>
        {part.label}
      </Switch>
    );
  }
  if (part.kind === "output") {
    return <OutputValue text={outputText} />;
  }
  return <span>{part.label}</span>;
}

/** One part, with a button that shows or hides its pins. */
export function PartRow(props: PartRowProps): ReactNode {
  const { part, isSelected, isExpanded, onToggle } = props;
  return (
    <li className={styles.part}>
      <div className={styles.item}>
        <PartControl
          part={part}
          isOn={props.isOn}
          outputText={props.outputText}
          onSetInput={props.onSetInput}
        />
        {isSelected ? <span className={styles.selected}>{m.structure_selected()}</span> : undefined}
        <Button
          variant="quiet"
          aria-expanded={isExpanded}
          aria-label={m.structure_pins_of({ part: part.label })}
          onPress={onToggle}
        >
          {m.structure_pins_toggle()}
        </Button>
        <PartActions part={part} />
      </div>
      {isExpanded ? (
        <ul className={styles.list}>
          {part.pins.map((pin) => (
            <PinRow key={String(pin.ref.pin)} pin={pin} />
          ))}
        </ul>
      ) : undefined}
    </li>
  );
}
