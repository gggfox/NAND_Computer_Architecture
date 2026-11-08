import type { ReactNode } from "react";

import { addPinAtCentre, openCircuit, partName, placeAtCentre } from "~/features/circuit-editor";
import type { EditorSession, PlaceableKind, Structure } from "~/features/circuit-editor";
import { EMPTY_CIRCUIT } from "~/features/projects";
import type { Project } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import type { InstanceId } from "~/shared/ids";
import { Button, MenuButton } from "~/shared/ui";
import type { MenuEntry } from "~/shared/ui";

import { useStructureSession } from "./structure-session";
import { SuggestedList } from "./SuggestedList";

import styles from "./StructureView.module.css";

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
 * The selection announces the part by name. An unknown entry does nothing.
 */
export const runAddPart = (session: EditorSession, id: string): void => {
  const add = ADD_PARTS[id];
  if (add === undefined) {
    return;
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
};

/** Sends one canvas command, as the toolbar and the keyboard do. */
const sendCommand = (session: EditorSession, type: "suggestWires" | "tidyWires"): void => {
  session.interaction.store.getState().send({ type: "command", command: { type } });
};

export interface StructureActionsProps {
  readonly structure: Structure;
}

/**
 * Add part, Suggest wires and Tidy wires, then the suggested wires while there are any: the
 * circuit-wide actions, above the Parts list.
 */
export function StructureActions({ structure }: StructureActionsProps): ReactNode {
  const session = useStructureSession();
  const project = session.editor.getState().history.present;
  return (
    <>
      <div className={styles.actions}>
        <MenuButton
          label={m.structure_actions_add_part()}
          entries={addPartEntries(project)}
          onAction={(id) => {
            runAddPart(session, id);
          }}
        />
        <Button
          onPress={() => {
            sendCommand(session, "suggestWires");
          }}
        >
          {m.suggest_wires()}
        </Button>
        <Button
          onPress={() => {
            sendCommand(session, "tidyWires");
          }}
        >
          {m.tidy_wires()}
        </Button>
      </div>
      <SuggestedList structure={structure} />
    </>
  );
}
