import { useState } from "react";
import type { ReactNode } from "react";

import type { BitWidth, PinDirection } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { Button, ModalDialog, NumberField, Select } from "~/shared/ui";

import { PIN_WIDTHS, widthOf } from "../domain/pin-rows";
import type { PinsRequest } from "../domain/pin-rows";
import { DialogForm } from "./ChipDialogs";

import styles from "./PinsPanel.module.css";

/** At most this many pins in one go. */
const MOST_AT_ONCE = 16;

interface AddPinsDialogProps {
  readonly direction: PinDirection;
  readonly onAdd: (request: PinsRequest) => void;
  readonly onClose: () => void;
}

const widthLabel = (width: BitWidth): string =>
  width === 1 ? m.pin_card_width_one() : m.pin_card_width({ width });

function AddActions({ onClose }: { readonly onClose: () => void }): ReactNode {
  return (
    <div className={styles.actions}>
      <Button variant="quiet" onPress={onClose}>
        {m.dialog_cancel()}
      </Button>
      <Button type="submit">{m.pins_add_confirm()}</Button>
    </div>
  );
}

/** How many pins of one direction to add, and how wide; Enter or Add adds them as one edit. */
export function AddPinsDialog({
  direction,
  onAdd,
  onClose,
}: Readonly<AddPinsDialogProps>): ReactNode {
  const [count, setCount] = useState(1);
  const [width, setWidth] = useState<BitWidth>(1);
  const title = direction === "input" ? m.pins_add_inputs_title() : m.pins_add_outputs_title();
  return (
    <ModalDialog title={title} onClose={onClose}>
      <DialogForm
        onSubmit={() => {
          onAdd({ direction, count, width });
        }}
      >
        <NumberField
          label={m.pins_add_count()}
          value={count}
          minValue={1}
          maxValue={MOST_AT_ONCE}
          onChange={setCount}
        />
        <Select
          label={m.pins_add_width()}
          options={PIN_WIDTHS.map((option) => ({ id: String(option), label: widthLabel(option) }))}
          value={String(width)}
          onChange={(key) => {
            setWidth(widthOf(key) ?? width);
          }}
        />
        <AddActions onClose={onClose} />
      </DialogForm>
    </ModalDialog>
  );
}
