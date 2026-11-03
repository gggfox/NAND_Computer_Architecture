import { useState } from "react";
import type { ReactNode } from "react";

import { m } from "~/i18n/paraglide/messages";
import { Button, ModalDialog, NumberField, Select } from "~/shared/ui";

import { ARRAY_LIMITS, arraySummary, defaultColumns } from "../domain/array";
import type { ArrayDirection, ArrayRequest } from "../domain/array";
import { DialogForm } from "./ChipDialogs";

import styles from "./PinsPanel.module.css";

/** What the form holds; `columns` is missing until the user types one, so it follows the count. */
interface Draft {
  readonly count: number;
  readonly direction: ArrayDirection;
  readonly columns?: number;
  readonly spacing: number;
}

const INITIAL: Draft = { count: 3, direction: "row", spacing: 1 };

const directionOf = (key: string): ArrayDirection =>
  key === "column" || key === "grid" ? key : "row";

const directionOptions = () => [
  { id: "row", label: m.array_direction_row() },
  { id: "column", label: m.array_direction_column() },
  { id: "grid", label: m.array_direction_grid() },
];

const requestOf = (draft: Draft): ArrayRequest => ({
  ...draft,
  columns: draft.columns ?? defaultColumns(draft.count),
});

function ColumnsField({
  value,
  onChange,
}: {
  readonly value: number;
  readonly onChange: (patch: Partial<Draft>) => void;
}): ReactNode {
  return (
    <NumberField
      label={m.array_columns()}
      value={value}
      minValue={ARRAY_LIMITS.columns.min}
      maxValue={ARRAY_LIMITS.columns.max}
      onChange={(columns) => {
        onChange({ columns });
      }}
    />
  );
}

function ArrayFields({
  draft,
  onChange,
}: {
  readonly draft: Draft;
  readonly onChange: (patch: Partial<Draft>) => void;
}): ReactNode {
  const request = requestOf(draft);
  return (
    <>
      <NumberField
        label={m.array_count()}
        value={draft.count}
        minValue={ARRAY_LIMITS.count.min}
        maxValue={ARRAY_LIMITS.count.max}
        onChange={(count) => {
          onChange({ count });
        }}
      />
      <Select
        label={m.array_direction()}
        options={directionOptions()}
        value={draft.direction}
        onChange={(key) => {
          onChange({ direction: directionOf(key) });
        }}
      />
      {draft.direction === "grid" ? (
        <ColumnsField value={request.columns} onChange={onChange} />
      ) : undefined}
      <NumberField
        label={m.array_spacing()}
        value={draft.spacing}
        minValue={ARRAY_LIMITS.spacing.min}
        maxValue={ARRAY_LIMITS.spacing.max}
        onChange={(spacing) => {
          onChange({ spacing });
        }}
      />
      <p aria-live="polite">{m.array_summary(arraySummary(request))}</p>
    </>
  );
}

function ArrayActions({ onClose }: { readonly onClose: () => void }): ReactNode {
  return (
    <div className={styles.actions}>
      <Button variant="quiet" onPress={onClose}>
        {m.dialog_cancel()}
      </Button>
      <Button type="submit">{m.array_confirm()}</Button>
    </div>
  );
}

/** Count, direction (and columns for a grid) and spacing; Enter or Create lays the copies out as one edit. */
export function ArrayDialog({
  onArray,
  onClose,
}: {
  readonly onArray: (request: ArrayRequest) => void;
  readonly onClose: () => void;
}): ReactNode {
  const [draft, setDraft] = useState(INITIAL);
  return (
    <ModalDialog title={m.array_title()} onClose={onClose}>
      <DialogForm
        onSubmit={() => {
          onArray(requestOf(draft));
        }}
      >
        <ArrayFields
          draft={draft}
          onChange={(patch) => {
            setDraft((before) => ({ ...before, ...patch }));
          }}
        />
        <ArrayActions onClose={onClose} />
      </DialogForm>
    </ModalDialog>
  );
}
