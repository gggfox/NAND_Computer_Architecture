import type { ReactNode } from "react";

import { addPinAtCentre, openCircuit, partName, placeAtCentre } from "~/features/circuit-editor";
import type { EditorSession, PlaceableKind } from "~/features/circuit-editor";
import { EMPTY_CIRCUIT } from "~/features/projects";
import type { Project } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import type { InstanceId } from "~/shared/ids";
import { MenuButton } from "~/shared/ui";
import type { MenuEntry } from "~/shared/ui";

import { useStructureSession } from "./structure-session";
import { focusRowWhenReady } from "./use-row-focus";

/** What one "Add part…" entry adds: a built-in part, or a pin of the open chip. */
type AddPart =
  | { readonly type: "part"; readonly kind: PlaceableKind }
  | { readonly type: "pin"; readonly direction: "input" | "output" };

const NIBBLE = 4;
const BYTE = 8;
const WORD = 16;

type BusWidth = Extract<PlaceableKind, { readonly width: number }>["width"];

const busEntries = (width: BusWidth): readonly (readonly [string, AddPart])[] => [
  [`split-${String(width)}`, { type: "part", kind: { type: "split", width } }],
  [`merge-${String(width)}`, { type: "part", kind: { type: "merge", width } }],
];

/** The built-in parts in library order. Saved chips stay in the library. */
const ADD_PARTS: Readonly<Record<string, AddPart>> = Object.fromEntries([
  ["nand", { type: "part", kind: { type: "nand" } }],
  ["input", { type: "pin", direction: "input" }],
  ["output", { type: "pin", direction: "output" }],
  ...busEntries(NIBBLE),
  ...busEntries(BYTE),
  ...busEntries(WORD),
  ["clock", { type: "part", kind: { type: "clock" } }],
] satisfies readonly (readonly [string, AddPart])[]);

const entryLabel = (project: Project, add: AddPart): string => {
  if (add.type === "pin") {
    return add.direction === "input"
      ? m.structure_actions_input_pin()
      : m.structure_actions_output_pin();
  }
  return partName(project, EMPTY_CIRCUIT, add.kind);
};

/** The entries of the "Add part…" menu, named as the library names them. */
export const addPartEntries = (project: Project): readonly MenuEntry[] =>
  Object.entries(ADD_PARTS).map(([id, add]) => ({ id, label: entryLabel(project, add) }));

const instanceIds = (session: EditorSession): ReadonlySet<InstanceId> =>
  new Set(openCircuit(session.editor.getState()).instances.map((item) => item.id));

/**
 * Adds one part at the viewport centre with the same command as the library, then selects it.
 * The selection announces the part by name. It returns the new part. An unknown entry does
 * nothing and returns nothing.
 */
export const runAddPart = (session: EditorSession, id: string): InstanceId | undefined => {
  const add = ADD_PARTS[id];
  if (add === undefined) {
    return undefined;
  }
  const before = instanceIds(session);
  if (add.type === "pin") {
    addPinAtCentre(session, add.direction);
  } else {
    placeAtCentre(session, add.kind);
  }
  const added = [...instanceIds(session)].filter((instanceId) => !before.has(instanceId));
  session.interaction.store.getState().send({
    type: "command",
    command: { type: "selectItems", instanceIds: added, wireIds: [] },
  });
  return added[0];
};

/** The "Add part…" menu. The new part is selected and its row takes focus (spec 3.6). */
export function AddPartMenu(): ReactNode {
  const session = useStructureSession();
  return (
    <MenuButton
      label={m.structure_actions_add_part()}
      entries={addPartEntries(session.editor.getState().history.present)}
      onAction={(id) => {
        const added = runAddPart(session, id);
        if (added !== undefined) {
          focusRowWhenReady(`part:${added}`);
        }
      }}
    />
  );
}
