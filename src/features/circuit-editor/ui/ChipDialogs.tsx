import { useState } from "react";
import type { ReactNode } from "react";

import { m } from "~/i18n/paraglide/messages";
import type { ChipId } from "~/shared/ids";
import { Button, ModalDialog, SwatchPicker, TextInput } from "~/shared/ui";
import type { Swatch } from "~/shared/ui";

import styles from "./ChipDialogs.module.css";

/** A chip dialog in progress: which chip, and its current name or colour. */
export type ChipDialog =
  | { readonly kind: "rename"; readonly chipId: ChipId; readonly name: string }
  | { readonly kind: "recolor"; readonly chipId: ChipId; readonly color: string };

interface ChipDialogProps<Kind extends ChipDialog["kind"]> {
  readonly dialog: Extract<ChipDialog, { kind: Kind }>;
  readonly onSave: (value: string) => void;
  readonly onClose: () => void;
}

const swatches = (): readonly Swatch[] => [
  { color: "#3b82f6", label: m.color_blue() },
  { color: "#ef4444", label: m.color_red() },
  { color: "#f59e0b", label: m.color_orange() },
  { color: "#22c55e", label: m.color_green() },
  { color: "#14b8a6", label: m.color_teal() },
  { color: "#8b5cf6", label: m.color_purple() },
  { color: "#ec4899", label: m.color_pink() },
  { color: "#6b7280", label: m.color_gray() },
];

function Actions({ onClose }: { readonly onClose: () => void }): ReactNode {
  return (
    <div className={styles.actions}>
      <Button variant="quiet" onPress={onClose}>
        {m.dialog_cancel()}
      </Button>
      <Button type="submit">{m.dialog_save()}</Button>
    </div>
  );
}

/** Renames the chip definition, so every instance of it shows the new name. */
export function RenameChipDialog({
  dialog,
  onSave,
  onClose,
}: ChipDialogProps<"rename">): ReactNode {
  const [name, setName] = useState(dialog.name);
  return (
    <ModalDialog title={m.rename_chip_title()} onClose={onClose}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          onSave(name);
        }}
      >
        <TextInput label={m.chip_name_label()} value={name} onChange={setName} />
        <Actions onClose={onClose} />
      </form>
    </ModalDialog>
  );
}

/** Recolours the chip definition; each swatch has a name, so colour is never the only cue. */
export function RecolorChipDialog({
  dialog,
  onSave,
  onClose,
}: ChipDialogProps<"recolor">): ReactNode {
  const [color, setColor] = useState(dialog.color);
  return (
    <ModalDialog title={m.recolor_chip_title()} onClose={onClose}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          onSave(color);
        }}
      >
        <SwatchPicker
          label={m.chip_color_label()}
          swatches={swatches()}
          value={color}
          onChange={setColor}
        />
        <Actions onClose={onClose} />
      </form>
    </ModalDialog>
  );
}
