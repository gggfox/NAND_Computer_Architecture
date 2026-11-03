import type { ReactNode } from "react";

import { m } from "~/i18n/paraglide/messages";
import { Button, ModalDialog } from "~/shared/ui";

import styles from "./KeyboardHelp.module.css";

/** The canvas keyboard map, as rows of keys and what they do (keymap.ts is the source). */
const rows = (): readonly (readonly [string, string])[] => [
  [m.help_keys_step(), m.help_step()],
  [m.help_keys_select_all(), m.help_select_all()],
  [m.help_keys_nudge(), m.help_nudge()],
  [m.help_keys_delete(), m.help_delete()],
  [m.help_keys_clipboard(), m.help_clipboard()],
  [m.help_keys_duplicate(), m.help_duplicate()],
  [m.help_keys_array(), m.help_array()],
  [m.help_keys_undo(), m.help_undo()],
  [m.help_keys_zoom(), m.help_zoom()],
  [m.help_keys_menu(), m.help_menu()],
  [m.help_keys_pins(), m.help_pins()],
  [m.help_keys_rename(), m.help_rename()],
  [m.help_keys_wire(), m.help_wire()],
  [m.help_keys_tools(), m.help_tools()],
  [m.help_keys_space(), m.help_space()],
  [m.help_keys_escape(), m.help_escape()],
  [m.help_keys_arm(), m.help_arm()],
  [m.help_keys_connect(), m.help_connect()],
  [m.help_keys_pick_pin(), m.help_pick_pin()],
  [m.help_keys_pick_all(), m.help_pick_all()],
  [m.help_keys_wire_picked(), m.help_wire_picked()],
  [m.help_keys_cancel_wiring(), m.help_cancel_wiring()],
  [m.help_keys_bend_step(), m.help_bend_step()],
  [m.help_keys_bend_move(), m.help_bend_move()],
  [m.help_keys_suggest(), m.help_suggest()],
  [m.help_keys_ghost_step(), m.help_ghost_step()],
  [m.help_keys_ghost_accept(), m.help_ghost_accept()],
  [m.help_keys_ghost_dismiss(), m.help_ghost_dismiss()],
];

function Row({ keys, action }: { readonly keys: string; readonly action: string }): ReactNode {
  return (
    <div className={styles.row}>
      <dt className={styles.keys}>{keys}</dt>
      <dd className={styles.action}>{action}</dd>
    </div>
  );
}

export function KeyboardHelp({ onClose }: { readonly onClose: () => void }): ReactNode {
  return (
    <ModalDialog title={m.keyboard_shortcuts()} onClose={onClose}>
      <dl className={styles.list}>
        {rows().map(([keys, action]) => (
          // Keys repeat (Escape, Enter), so the action names the row.
          <Row key={action} keys={keys} action={action} />
        ))}
      </dl>
      <Button onPress={onClose}>{m.dialog_close()}</Button>
    </ModalDialog>
  );
}
