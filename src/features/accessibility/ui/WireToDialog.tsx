import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";

import {
  DialogForm,
  editorErrorMessage,
  openCircuit,
  wireTargets,
} from "~/features/circuit-editor";
import type { PinEntry, WireTarget } from "~/features/circuit-editor";
import { checkConnection } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { Button, ModalDialog, NumberField, SearchList } from "~/shared/ui";

import { useStructureSession } from "./structure-session";
import { bitAsk, matching, refsOf, targetKey } from "./wire-to-plan";
import type { BitChoice } from "./wire-to-plan";

import styles from "./WireToDialog.module.css";

const NO_BITS: BitChoice = { from: 0, target: 0 };

export interface WireToFormProps {
  /** The pin the dialog was opened on, with the name of its part. */
  readonly pin: PinEntry;
  readonly pinLabel: string;
  /** The targets that match the search. */
  readonly targets: readonly WireTarget[];
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  /** The chosen target; nothing until one is picked. */
  readonly chosen: WireTarget | undefined;
  readonly onChoose: (key: string) => void;
  readonly bits: BitChoice;
  readonly onBitsChange: (bits: BitChoice) => void;
  /** Why the wire was refused, translated; nothing until it is. */
  readonly error: string | undefined;
  readonly onWire: () => void;
  readonly onClose: () => void;
}

const bitName = (label: string, bit: number, asked: number): string =>
  asked > 1 ? m.wire_to_bit({ pin: label, bit }) : label;

/** The one-line summary: the pair in the direction of the signal, with the bits that are asked. */
const summaryOf = (props: WireToFormProps): string => {
  const { chosen, pin, pinLabel, bits } = props;
  if (chosen === undefined) {
    return m.wire_to_summary_none();
  }
  const ask = bitAsk(pin.width, chosen);
  const own = bitName(pinLabel, bits.from, ask.from);
  const other = bitName(chosen.label, bits.target, ask.target);
  return pin.direction === "output"
    ? m.wire_to_summary({ from: own, to: other })
    : m.wire_to_summary({ from: other, to: own });
};

function BitField({
  label,
  asked,
  value,
  onChange,
}: {
  readonly label: string;
  readonly asked: number;
  readonly value: number;
  readonly onChange: (bit: number) => void;
}): ReactNode {
  return asked > 1 ? (
    <NumberField
      label={label}
      value={value}
      minValue={0}
      maxValue={asked - 1}
      onChange={onChange}
    />
  ) : undefined;
}

/** A bit field for each bus end. A one-bit end gets none. */
function BitFields({ props }: { readonly props: WireToFormProps }): ReactNode {
  const { chosen, pin, pinLabel, bits, onBitsChange } = props;
  if (chosen === undefined) {
    return undefined;
  }
  const ask = bitAsk(pin.width, chosen);
  return (
    <>
      <BitField
        label={m.wire_to_bit_of({ pin: pinLabel })}
        asked={ask.from}
        value={bits.from}
        onChange={(from) => {
          onBitsChange({ ...bits, from });
        }}
      />
      <BitField
        label={m.wire_to_bit_of({ pin: chosen.label })}
        asked={ask.target}
        value={bits.target}
        onChange={(target) => {
          onBitsChange({ ...bits, target });
        }}
      />
    </>
  );
}

function WireToActions({ onClose }: { readonly onClose: () => void }): ReactNode {
  return (
    <div className={styles.actions}>
      <Button variant="quiet" onPress={onClose}>
        {m.dialog_cancel()}
      </Button>
      <Button type="submit">{m.wire_to_confirm()}</Button>
    </div>
  );
}

/**
 * The search list, the bit fields, the summary and the buttons. The search sits outside the form,
 * so Enter there picks a pin and never submits. A refusal shows here and the dialog stays open.
 */
export function WireToForm(props: WireToFormProps): ReactNode {
  const { targets, query, onQueryChange, onChoose, error, onWire, onClose } = props;
  return (
    <>
      <SearchList
        label={m.wire_to_list()}
        searchLabel={m.wire_to_search()}
        query={query}
        onQueryChange={onQueryChange}
        sections={[
          {
            id: "targets",
            entries: targets.map((target) => ({ id: targetKey(target), label: target.label })),
          },
        ]}
        onAction={onChoose}
      />
      {targets.length === 0 ? <p>{m.wire_to_none()}</p> : undefined}
      <DialogForm onSubmit={onWire}>
        <p aria-live="polite">{summaryOf(props)}</p>
        <BitFields props={props} />
        {error === undefined ? undefined : (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <WireToActions onClose={onClose} />
      </DialogForm>
    </>
  );
}

export interface WireToDialogProps {
  readonly pin: PinEntry;
  /** "{pin} of {part}". */
  readonly pinLabel: string;
  readonly onClose: () => void;
}

/** The choice in progress: the search, the target, the bits and the refusal. */
function useChoice(all: readonly WireTarget[]) {
  const [query, setQuery] = useState("");
  const [chosenKey, setChosenKey] = useState<string | undefined>();
  const [bits, setBits] = useState(NO_BITS);
  const [error, setError] = useState<string | undefined>();
  return {
    query,
    handleQueryChange: setQuery,
    bits,
    error,
    chosen: all.find((target) => targetKey(target) === chosenKey),
    setError,
    handleChoose: (key: string): void => {
      setChosenKey(key);
      setBits(NO_BITS);
      setError(undefined);
    },
    handleBitsChange: (next: BitChoice): void => {
      setBits(next);
      setError(undefined);
    },
  };
}

/**
 * "Wire to…" (an output pin) or "Wire from…" (an input pin): pick a legal pin by name, pick the
 * bit of a bus end, and send one `connectPins`. A refusal shows in the dialog.
 */
export function WireToDialog({ pin, pinLabel, onClose }: WireToDialogProps): ReactNode {
  const { editor, interaction } = useStructureSession();
  const project = useStore(editor, (state) => state.history.present);
  const circuit = useStore(editor, openCircuit);
  const all = useMemo(() => wireTargets({ project, circuit }, pin.ref), [project, circuit, pin]);
  const choice = useChoice(all);
  const { chosen, bits, setError } = choice;
  const wire = (): void => {
    if (chosen === undefined) {
      return;
    }
    const refs = refsOf(pin, chosen, bits);
    const checked = checkConnection(project, circuit, refs.from, refs.to);
    if (checked.ok) {
      interaction.store.getState().send({
        type: "command",
        command: { type: "connectPins", from: refs.from, to: refs.to },
      });
      onClose();
    } else {
      setError(editorErrorMessage(checked.error));
    }
  };
  const title =
    pin.direction === "output"
      ? m.wire_to_title_to({ pin: pinLabel })
      : m.wire_to_title_from({ pin: pinLabel });
  return (
    <ModalDialog title={title} onClose={onClose}>
      <WireToForm
        pin={pin}
        pinLabel={pinLabel}
        targets={matching(all, choice.query)}
        query={choice.query}
        onQueryChange={choice.handleQueryChange}
        chosen={chosen}
        onChoose={choice.handleChoose}
        bits={bits}
        onBitsChange={choice.handleBitsChange}
        error={choice.error}
        onWire={wire}
        onClose={onClose}
      />
    </ModalDialog>
  );
}
