import { useState } from "react";
import type { ReactNode } from "react";

import type { PinDirection } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import type { PinId } from "~/shared/ids";
import { MenuButton, Select, TextInput } from "~/shared/ui";

import { PIN_WIDTHS, widthOf } from "../domain/pin-rows";
import type { PinRowModel } from "../domain/pin-rows";
import type { PinCommands } from "./pin-commands";
import { PinValue } from "./PinValue";

import styles from "./PinsPanel.module.css";

/** What a row reports back to its list. */
export interface RowActions {
  readonly commands: PinCommands;
  readonly registerName: (pinId: PinId, field: HTMLInputElement | null) => void;
  /** Enter saved the name: go on to the next row's name. */
  readonly onNameDone: (pinId: PinId) => void;
  readonly onDelete: (pinId: PinId) => void;
  readonly onSetInput: (pinId: PinId, value: number) => void;
}

interface PinRowProps {
  readonly row: PinRowModel;
  readonly direction: PinDirection;
  /** How many pins share its direction, so the last cannot move down. */
  readonly count: number;
  readonly value: number | undefined;
  readonly actions: RowActions;
}

type FieldProps = Pick<PinRowProps, "row" | "direction" | "actions">;

const directionWord = (direction: PinDirection): string =>
  direction === "input" ? m.pins_direction_input() : m.pins_direction_output();

interface Draft {
  readonly text: string;
  /** Why the last save was refused. */
  readonly error?: string | undefined;
}

/** The field's text, which follows the saved name whenever an undo or the canvas changes it. */
const useNameDraft = ({ row, actions }: Omit<FieldProps, "direction">) => {
  const [draft, setDraft] = useState<Draft>({ text: row.name });
  const [shown, setShown] = useState(row.name);
  if (row.name !== shown) {
    setShown(row.name);
    setDraft({ text: row.name });
  }
  const save = (): boolean => {
    // Read from the store, not this render: Enter's save and the blur that follows make one edit.
    const unchanged = draft.text.trim() === actions.commands.nameOf(row.pinId);
    const error = unchanged ? undefined : actions.commands.rename(row.pinId, draft.text);
    setDraft({ text: draft.text, error });
    return error === undefined;
  };
  const edit = (text: string): void => {
    setDraft({ text });
  };
  const restore = (): void => {
    edit(row.name);
  };
  return { draft, save, edit, restore };
};

/** Saves on Enter (then moves on) and on blur; Escape puts the saved name back. */
function NameField({ row, direction, actions }: Readonly<FieldProps>): ReactNode {
  const { draft, save, edit, restore } = useNameDraft({ row, actions });
  return (
    <TextInput
      label={m.pins_name_label({ direction: directionWord(direction), ordinal: row.ordinal })}
      isLabelHidden
      value={draft.text}
      onChange={edit}
      errorMessage={draft.error}
      onEnter={() => {
        if (save()) {
          actions.onNameDone(row.pinId);
        }
      }}
      onEscape={restore}
      onBlur={() => {
        save();
      }}
      inputRef={(field) => {
        actions.registerName(row.pinId, field);
      }}
    />
  );
}

function WidthSelect({ row, actions }: Readonly<Omit<FieldProps, "direction">>): ReactNode {
  return (
    <Select
      label={m.pins_width_label({ name: row.name })}
      isLabelHidden
      options={PIN_WIDTHS.map((width) => ({ id: String(width), label: String(width) }))}
      value={String(row.width)}
      onChange={(key) => {
        const width = widthOf(key);
        if (width !== undefined && width !== row.width) {
          actions.commands.setWidth(row.pinId, width);
        }
      }}
    />
  );
}

const MOVE_UP = "up";
const MOVE_DOWN = "down";
const DELETE = "delete";

function RowMenu({
  row,
  count,
  actions,
}: Readonly<Omit<PinRowProps, "direction" | "value">>): ReactNode {
  const { pinId, ordinal } = row;
  const disabledIds = [
    ...(ordinal === 1 ? [MOVE_UP] : []),
    ...(ordinal === count ? [MOVE_DOWN] : []),
  ];
  return (
    <MenuButton
      label={m.pins_more({ name: row.name })}
      entries={[
        { id: MOVE_UP, label: m.pins_move_up() },
        { id: MOVE_DOWN, label: m.pins_move_down() },
        { id: DELETE, label: m.pins_delete() },
      ]}
      disabledIds={disabledIds}
      onAction={(id) => {
        if (id === DELETE) {
          actions.onDelete(pinId);
          return;
        }
        // `ordinal` is 1-based; the edit's index is 0-based within the direction.
        const index = ordinal - 1;
        actions.commands.move(pinId, id === MOVE_UP ? index - 1 : index + 1);
      }}
    />
  );
}

/** One pin: its number, name, width, value and a menu to move or delete it. */
export function PinRow({
  row,
  direction,
  count,
  value,
  actions,
}: Readonly<PinRowProps>): ReactNode {
  const { onSetInput } = actions;
  return (
    <>
      <span className={styles.badge} aria-hidden="true">
        {row.ordinal}
      </span>
      <span className={styles.name}>
        <NameField row={row} direction={direction} actions={actions} />
      </span>
      <span className={styles.width}>
        <WidthSelect row={row} actions={actions} />
      </span>
      <span className={styles.controls}>
        <PinValue row={row} direction={direction} value={value} onSetInput={onSetInput} />
        <RowMenu row={row} count={count} actions={actions} />
      </span>
    </>
  );
}
