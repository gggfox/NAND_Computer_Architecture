import type { ReactNode } from "react";
import { useStore } from "zustand";

import { findChip } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import type { ChipId } from "~/shared/ids";
import { Button, MenuButton } from "~/shared/ui";

import type { EditorSession } from "../application/editor-session";
import { SaveDialogs } from "./SaveDialogs";
import type { FirstSaveSlot } from "./SaveDialogs";
import { useSaveFlow } from "./use-save-flow";
import type { SaveFlow } from "./use-save-flow";

import styles from "./ChipHeader.module.css";

/** The trail's chips, outermost first, with their names read live (a rename shows at once). */
const useTrailNames = (
  session: EditorSession,
): readonly { readonly chipId: ChipId; readonly name: string }[] => {
  const trail = useStore(session.editor, (state) => state.trail);
  const project = useStore(session.editor, (state) => state.history.present);
  return trail.map((chipId) => ({ chipId, name: findChip(project, chipId)?.name ?? "" }));
};

/** An earlier chip goes back to it; the open chip is plain text. */
function Crumb({
  name,
  isCurrent,
  onBack,
}: {
  readonly name: string;
  readonly isCurrent: boolean;
  readonly onBack: () => void;
}): ReactNode {
  if (isCurrent) {
    return (
      <span aria-current="page" className={styles.current}>
        {name}
      </span>
    );
  }
  return (
    <Button variant="quiet" onPress={onBack}>
      <span className={styles.name}>{name}</span>
    </Button>
  );
}

/** Where the open chip sits in the Look inside trail. */
function Breadcrumbs({ session }: { readonly session: EditorSession }): ReactNode {
  const crumbs = useTrailNames(session);
  const { goBack } = session.editor.getState();
  const items = crumbs.map(({ chipId, name }, index) => (
    <li key={chipId} className={styles.crumb}>
      <Crumb
        name={name}
        isCurrent={index === crumbs.length - 1}
        onBack={() => {
          goBack(index);
        }}
      />
    </li>
  ));
  return (
    <nav aria-label={m.chip_path_label()} className={styles.path}>
      <ol className={styles.crumbs}>{items}</ol>
    </nav>
  );
}

const DISCARD = "discard";

/** Save, and the ⋯ menu while it has an entry: Discard, only for a saved chip with changes. */
function HeaderActions({ flow }: { readonly flow: SaveFlow }): ReactNode {
  const { state, save, requestDiscard } = flow;
  return (
    <div className={styles.actions}>
      <Button isDisabled={state === "saved"} onPress={save}>
        {m.chip_save()}
      </Button>
      {state === "changed" ? (
        <MenuButton
          label={m.chip_more_label()}
          entries={[{ id: DISCARD, label: m.chip_discard() }]}
          onAction={requestDiscard}
        />
      ) : undefined}
    </div>
  );
}

const outcomeText = (flow: SaveFlow): string => {
  if (flow.outcome === "saved") {
    return m.chip_saved({ name: flow.name });
  }
  return flow.outcome === "discarded" ? m.chip_discarded({ name: flow.name }) : "";
};

interface ChipHeaderProps {
  readonly session: EditorSession;
  readonly firstSave?: FirstSaveSlot | undefined;
  /** Before the breadcrumbs: the way out of the project. */
  readonly start?: ReactNode;
  /** Just before Save: page-wide preferences, so they need no row of their own. */
  readonly end?: ReactNode;
}

/**
 * The open chip's header (D9): its breadcrumbs, a dot while it has unsaved changes, Save and the
 * ⋯ menu, and a polite status that says what a save or discard did (D11).
 */
export function ChipHeader({ session, firstSave, start, end }: ChipHeaderProps): ReactNode {
  const flow = useSaveFlow(session, firstSave !== undefined);
  return (
    <div className={styles.header}>
      {start === undefined ? undefined : <span className={styles.start}>{start}</span>}
      <Breadcrumbs session={session} />
      {flow.state === "saved" ? undefined : (
        <span className={styles.dot}>
          <span className="visually-hidden">{m.chip_unsaved()}</span>
        </span>
      )}
      {end === undefined ? undefined : <span className={styles.end}>{end}</span>}
      <HeaderActions flow={flow} />
      <output className={styles.outcome}>{outcomeText(flow)}</output>
      <SaveDialogs flow={flow} firstSave={firstSave} />
    </div>
  );
}

export type { FirstSaveContext, FirstSaveSlot } from "./SaveDialogs";
