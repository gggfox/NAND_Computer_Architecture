import { useState } from "react";
import type { ReactNode, RefObject } from "react";
import { useStore } from "zustand";

import type { PinDef } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { TextInput } from "~/shared/ui";

import type { EditorSession } from "../application/editor-session";
import { editorErrorMessage } from "../domain/editor-error-messages";
import type { Renaming } from "../domain/interaction";
import { pieceDef } from "../domain/interaction-pins";

import styles from "./PinRenamePopover.module.css";

/** Keeps the popover's start edge on the canvas when a name sits at its left edge. */
const MIN_INSET_PX = 8;

interface PinRenamePopoverProps {
  readonly session: EditorSession;
  readonly renaming: Renaming;
  /** The canvas host, which takes focus back when the popover closes. */
  readonly hostRef: RefObject<HTMLElement | null>;
}

/** Closing gives focus back to the canvas; saving an unchanged name just closes. */
const useRename = (
  { session, hostRef }: Omit<PinRenamePopoverProps, "renaming">,
  def: PinDef,
  onError: (message: string) => void,
) => {
  const close = (): void => {
    session.interaction.store.getState().send({ type: "command", command: { type: "endRename" } });
    hostRef.current?.focus({ preventScroll: true });
  };
  const save = (name: string): void => {
    // Refused here, not by the edit, so the field alone says why (no status-bar error as well).
    if (name.trim() === "") {
      onError(editorErrorMessage({ type: "EmptyName" }));
      return;
    }
    const { chipId, dispatch } = session.editor.getState();
    const result =
      name.trim() === def.name
        ? undefined
        : dispatch({ type: "renamePin", chipId, pinId: def.id, name });
    if (result === undefined || result.ok) {
      close();
    } else {
      onError(editorErrorMessage(result.error));
    }
  };
  return { close, save };
};

/** The form, once the piece's pin definition is known. */
function RenameForm({
  props,
  def,
}: {
  readonly props: PinRenamePopoverProps;
  readonly def: PinDef;
}): ReactNode {
  const [name, setName] = useState(def.name);
  const [error, setError] = useState<string>();
  const { close, save } = useRename(props, def, setError);
  const { screen } = props.renaming;
  return (
    <form
      className={styles.popover}
      style={{ insetInlineStart: Math.max(MIN_INSET_PX, screen.x), insetBlockStart: screen.y }}
      onSubmit={(event) => {
        event.preventDefault();
        save(name);
      }}
    >
      <TextInput
        label={m.pin_rename_label()}
        value={name}
        onChange={(next) => {
          setName(next);
          setError(undefined);
        }}
        focusOnMount
        errorMessage={error}
        onEscape={close}
      />
    </form>
  );
}

/**
 * Renames a pin piece in place (spec §5.5): Enter saves as one edit, Escape cancels, and either
 * gives focus back to the canvas. An empty name is refused inline and the field stays open.
 */
export function PinRenamePopover(props: PinRenamePopoverProps): ReactNode {
  const { session, renaming } = props;
  const circuit = useStore(session.editor, (state) => session.interaction.sceneOf(state).circuit);
  const def = pieceDef(circuit, renaming.instanceId);
  return def === undefined ? undefined : <RenameForm props={props} def={def} />;
}
