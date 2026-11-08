import type { EditorSession, InteractionCommand, WireEntry } from "~/features/circuit-editor";
import type { WireColor } from "~/features/projects";

/** The command for one menu entry. The colour entry sends `recolorSelection` after the dialog. */
const commandFor = (
  id: string,
  wire: WireEntry,
  color: WireColor | undefined,
): InteractionCommand | undefined => {
  const { wireId } = wire;
  const commands: Readonly<Record<string, InteractionCommand>> = {
    delete: { type: "deleteSelection" },
    color: { type: "recolorSelection", ...(color === undefined ? {} : { color }) },
    reroute: { type: "rerouteWire", wireId },
    branch: { type: "branch", wireId },
    bends: { type: "editBends", wireId },
  };
  return commands[id];
};

/** Selects the wire, then sends the same command as the canvas wire menu. */
export const runWireAction = (
  session: EditorSession,
  wire: WireEntry,
  choice: { readonly id: string; readonly color?: WireColor },
): void => {
  const { id, color } = choice;
  const command = commandFor(id, wire, color);
  if (command === undefined) {
    return;
  }
  const { send } = session.interaction.store.getState();
  send({
    type: "command",
    command: { type: "selectItems", instanceIds: [], wireIds: [wire.wireId] },
  });
  send({ type: "command", command });
};
