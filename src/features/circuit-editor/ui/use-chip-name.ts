import { useStore } from "zustand";

import { findChip } from "~/features/projects";

import type { EditorSession } from "../application/editor-session";

/** The open chip's name, kept current; empty while the chip is missing. */
export const useChipName = (session: EditorSession): string =>
  useStore(session.editor, (state) => findChip(state.history.present, state.chipId)?.name ?? "");
