import type { ReactNode } from "react";
import { useStore } from "zustand";

import { openCircuit } from "~/features/circuit-editor";
import type { EditorSession, OutputReading } from "~/features/circuit-editor";
import type { Circuit } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import type { PinId } from "~/shared/ids";
import { Button } from "~/shared/ui";

/** Every output pin of the circuit, in pin order, with its level (`undefined` when not known). */
export const readingsOf = (
  circuit: Pick<Circuit, "pins">,
  outputs: ReadonlyMap<PinId, number>,
): readonly OutputReading[] =>
  circuit.pins
    .filter((pin) => pin.direction === "output")
    .map((pin) => ({ name: pin.name, value: outputs.get(pin.id) }));

interface OutputsReaderProps {
  readonly session: EditorSession;
}

/**
 * A button that says all outputs once, as "Outputs: SUM 1, CARRY 0". It sends a command, so the
 * canvas region speaks the line. This view has no region of its own for it.
 */
export function OutputsReader({ session }: OutputsReaderProps): ReactNode {
  const circuit = useStore(session.editor, openCircuit);
  const outputs = useStore(session.simulation, (state) => state.outputs);
  return (
    <Button
      variant="quiet"
      onPress={() => {
        session.interaction.store.getState().send({
          type: "command",
          command: { type: "readOutputs", readings: readingsOf(circuit, outputs) },
        });
      }}
    >
      {m.structure_read_outputs()}
    </Button>
  );
}
