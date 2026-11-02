import type { ReactNode } from "react";

import { m } from "~/i18n/paraglide/messages";
import type { ChipId } from "~/shared/ids";
import { Button, ModalDialog } from "~/shared/ui";

import type { SaveConsequence } from "../domain/save-preview";
import type { SaveFlow } from "./use-save-flow";

import styles from "./ChipHeader.module.css";

/** What the first save of a never-saved chip shows instead of saving at once (D6). */
export interface FirstSaveContext {
  readonly chipId: ChipId;
  /** Saves the chip (call after filing it); closes the slot. */
  readonly save: () => void;
  readonly cancel: () => void;
}

export type FirstSaveSlot = (context: FirstSaveContext) => ReactNode;

const consequenceText = (consequence: SaveConsequence): string => {
  if (consequence.type === "wiresRemoved") {
    return m.chip_save_wires_removed({ chip: consequence.chipName, count: consequence.count });
  }
  return consequence.type === "pinRemoved"
    ? m.chip_save_pin_removed({ name: consequence.name })
    : m.chip_save_pin_width(consequence);
};

/** Cancel, then the action the dialog confirms. */
function ConfirmActions({
  label,
  onConfirm,
  onClose,
}: {
  readonly label: string;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}): ReactNode {
  return (
    <div className={styles.buttons}>
      <Button variant="quiet" onPress={onClose}>
        {m.dialog_cancel()}
      </Button>
      <Button onPress={onConfirm}>{label}</Button>
    </div>
  );
}

function ConfirmSaveDialog({
  flow,
  consequences,
}: {
  readonly flow: SaveFlow;
  readonly consequences: readonly SaveConsequence[];
}): ReactNode {
  const { name, confirmSave, close } = flow;
  return (
    <ModalDialog title={m.chip_save_title({ name })} onClose={close}>
      <p className={styles.prose}>{m.chip_save_body()}</p>
      <ul className={styles.consequences}>
        {consequences.map((consequence) => {
          const text = consequenceText(consequence);
          return <li key={text}>{text}</li>;
        })}
      </ul>
      <ConfirmActions label={m.chip_save()} onConfirm={confirmSave} onClose={close} />
    </ModalDialog>
  );
}

function DiscardDialog({ flow }: { readonly flow: SaveFlow }): ReactNode {
  const { name, confirmDiscard, close } = flow;
  return (
    <ModalDialog title={m.chip_discard_title({ name })} onClose={close}>
      <p className={styles.prose}>{m.chip_discard_body()}</p>
      <ConfirmActions label={m.chip_discard_confirm()} onConfirm={confirmDiscard} onClose={close} />
    </ModalDialog>
  );
}

/** The dialog the save flow is waiting on, if any. */
export function SaveDialogs({
  flow,
  firstSave,
}: {
  readonly flow: SaveFlow;
  readonly firstSave?: FirstSaveSlot | undefined;
}): ReactNode {
  const { dialog } = flow;
  if (dialog === undefined) {
    return undefined;
  }
  if (dialog.kind === "confirmSave") {
    return <ConfirmSaveDialog flow={flow} consequences={dialog.consequences} />;
  }
  if (dialog.kind === "discard") {
    return <DiscardDialog flow={flow} />;
  }
  return firstSave?.({ chipId: dialog.chipId, save: flow.confirmSave, cancel: flow.close });
}
