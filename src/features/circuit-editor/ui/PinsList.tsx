import { useId } from "react";
import type { ReactNode } from "react";

import type { PinDirection } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { ReorderList } from "~/shared/ui";

import type { PinRowModel } from "../domain/pin-rows";
import { PinRow } from "./PinRow";
import type { RowActions } from "./PinRow";
import type { PinsView } from "./use-pins";

import styles from "./PinsPanel.module.css";

interface PinsListProps {
  readonly view: PinsView;
  readonly actions: RowActions;
}

interface SectionProps extends PinsListProps {
  readonly direction: PinDirection;
  readonly rows: readonly PinRowModel[];
}

/** One direction's heading and rows; nothing when it has no pins. */
function PinSection({ view, actions, direction, rows }: Readonly<SectionProps>): ReactNode {
  const headingId = useId();
  if (rows.length === 0) {
    return undefined;
  }
  const title = direction === "input" ? m.pins_inputs() : m.pins_outputs();
  const values = direction === "input" ? view.inputs : view.outputs;
  const byPin = new Map(rows.map((row) => [String(row.pinId), row]));
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.subheading}>
        {title}
      </h3>
      <ReorderList
        label={title}
        items={rows}
        getKey={(row) => row.pinId}
        getText={(row) => row.name}
        selectedKeys={rows.filter((row) => row.selected).map((row) => row.pinId)}
        onSelect={(keys) => {
          actions.commands.select(keys.flatMap((key) => byPin.get(key)?.instanceId ?? []));
        }}
        onMove={(key, toIndex) => {
          const row = byPin.get(key);
          if (row !== undefined) {
            actions.commands.move(row.pinId, toIndex);
          }
        }}
        renderRow={(row) => (
          <PinRow
            row={row}
            direction={direction}
            count={rows.length}
            value={values.get(row.pinId)}
            actions={actions}
          />
        )}
      />
    </section>
  );
}

/** The Inputs and Outputs sections, in panel order, or a hint when there are no pins yet. */
export function PinsList({ view, actions }: Readonly<PinsListProps>): ReactNode {
  const { inputs, outputs } = view.rows;
  if (inputs.length === 0 && outputs.length === 0) {
    return <p className={styles.empty}>{m.pins_empty()}</p>;
  }
  return (
    <>
      <PinSection view={view} actions={actions} direction="input" rows={inputs} />
      <PinSection view={view} actions={actions} direction="output" rows={outputs} />
    </>
  );
}
