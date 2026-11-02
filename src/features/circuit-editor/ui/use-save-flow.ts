import { useState } from "react";
import { useStore } from "zustand";

import { findChip, unsavedState } from "~/features/projects";
import type { Project, UnsavedState } from "~/features/projects";
import type { ChipId } from "~/shared/ids";

import type { EditorSession } from "../application/editor-session";
import { savePreview } from "../domain/save-preview";
import type { SaveConsequence } from "../domain/save-preview";

/** A save or discard waiting on the user, for the chip it was asked for. */
type SaveDialog =
  | {
      readonly kind: "confirmSave";
      readonly chipId: ChipId;
      readonly consequences: readonly SaveConsequence[];
    }
  | { readonly kind: "discard"; readonly chipId: ChipId }
  | { readonly kind: "firstSave"; readonly chipId: ChipId };

type OutcomeKind = "saved" | "discarded";

interface Outcome {
  readonly kind: OutcomeKind;
  readonly chipId: ChipId;
}

export interface SaveFlow {
  readonly chipId: ChipId;
  /** The open chip's name, read live. */
  readonly name: string;
  readonly state: UnsavedState;
  readonly dialog: SaveDialog | undefined;
  /** The open chip's last save or discard, while nothing changed in it since (D11). */
  readonly outcome: OutcomeKind | undefined;
  /** The Save button: saves at once, or opens the dialog the save needs first. */
  readonly save: () => void;
  readonly requestDiscard: () => void;
  /** Saves the dialog's chip; for the first save, after the slot filed it (D6). */
  readonly confirmSave: () => void;
  readonly confirmDiscard: () => void;
  readonly close: () => void;
}

type Step = { readonly kind: "now" } | SaveDialog;

/**
 * What Save does for a chip (D4, D6). A preview that fails saves anyway, so the store reports
 * the refusal through `lastError` (D11).
 */
const saveStep = (project: Project, chipId: ChipId, hasFirstSave: boolean): Step => {
  const chip = findChip(project, chipId);
  if (chip?.saved === undefined) {
    return hasFirstSave ? { kind: "firstSave", chipId } : { kind: "now" };
  }
  const preview = savePreview(project, chipId);
  return !preview.ok || preview.value.consequences.length === 0
    ? { kind: "now" }
    : { kind: "confirmSave", chipId, consequences: preview.value.consequences };
};

const NOTHING_OPEN = { name: "", state: "saved" } as const;

/** The open chip's name and unsaved state, read live from the editor store. */
const useOpenChip = (
  session: EditorSession,
): { readonly name: string; readonly state: UnsavedState } => {
  const chip = useStore(session.editor, (state) => findChip(state.history.present, state.chipId));
  return chip === undefined ? NOTHING_OPEN : { name: chip.name, state: unsavedState(chip) };
};

/** Save and Discard for the open chip, with the dialogs they need and what they did. */
export const useSaveFlow = (session: EditorSession, hasFirstSave: boolean): SaveFlow => {
  const { editor } = session;
  const chipId = useStore(editor, (state) => state.chipId);
  const { name, state } = useOpenChip(session);
  const [dialog, setDialog] = useState<SaveDialog>();
  const [outcome, setOutcome] = useState<Outcome>();

  const run = (kind: OutcomeKind, target: ChipId): void => {
    setDialog(undefined);
    const type = kind === "saved" ? "saveChip" : "discardDraft";
    if (editor.getState().dispatch({ type, chipId: target }).ok) {
      setOutcome({ kind, chipId: target });
    }
  };
  const target = dialog?.chipId ?? chipId;

  return {
    chipId,
    name,
    state,
    dialog,
    outcome: outcome?.chipId === chipId && state === "saved" ? outcome.kind : undefined,
    save: () => {
      if (state === "saved") {
        return;
      }
      const step = saveStep(editor.getState().history.present, chipId, hasFirstSave);
      if (step.kind === "now") {
        run("saved", chipId);
      } else {
        setDialog(step);
      }
    },
    requestDiscard: () => {
      setDialog({ kind: "discard", chipId });
    },
    confirmSave: () => {
      run("saved", target);
    },
    confirmDiscard: () => {
      run("discarded", target);
    },
    close: () => {
      setDialog(undefined);
    },
  };
};
