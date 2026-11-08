import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";

import { openCircuit, structureOf } from "~/features/circuit-editor";
import type { EditorSession, PinEntry } from "~/features/circuit-editor";
import { m } from "~/i18n/paraglide/messages";
import { MenuButton } from "~/shared/ui";

import { useStructureSession } from "./structure-session";
import { useRowFocus } from "./use-row-focus";
import { WireToDialog } from "./WireToDialog";

export interface PinActionsProps {
  readonly pin: PinEntry;
}

/** The most pins a part has to step through: `P` cycles, so one lap is enough. */
const MAX_PIN_STEPS = 64;

/**
 * Speaks the pin as the `P` key does: selects its part, then steps through the part's pins until
 * the pin card rests on this one. The canvas live region says the words.
 */
const describePin = ({ interaction }: EditorSession, pin: PinEntry): void => {
  const { send } = interaction.store.getState();
  send({
    type: "command",
    command: { type: "selectItems", instanceIds: [pin.ref.instanceId], wireIds: [] },
  });
  for (let step = 0; step < MAX_PIN_STEPS; step += 1) {
    send({ type: "command", command: { type: "nextPin", backwards: false } });
    if (interaction.store.getState().card?.pin === pin.ref.pin) {
      return;
    }
  }
};

/** The pin menu: "Wire to…" (an output pin) or "Wire from…" (an input pin), and "Describe pin". */
export function PinActions({ pin }: PinActionsProps): ReactNode {
  const session = useStructureSession();
  const { editor } = session;
  const project = useStore(editor, (state) => state.history.present);
  const circuit = useStore(editor, openCircuit);
  const part = useMemo(
    () =>
      structureOf({ project, circuit }).parts.find(
        (candidate) => candidate.instanceId === pin.ref.instanceId,
      ),
    [project, circuit, pin.ref.instanceId],
  );
  const [isWiring, setIsWiring] = useState(false);
  const focus = useRowFocus(`pin:${pin.ref.instanceId}:${String(pin.ref.pin)}`);
  const pinLabel = m.canvas_wire_end({ pin: pin.name, chip: part?.label ?? "" });
  const wireId = pin.direction === "output" ? "wire" : "wire-from";
  return (
    <>
      <MenuButton
        label={m.pin_actions_label({ pin: pin.name, part: part?.label ?? "" })}
        buttonRef={focus.register}
        entries={[
          {
            id: wireId,
            label: pin.direction === "output" ? m.pin_actions_wire_to() : m.pin_actions_wire_from(),
          },
          { id: "describe", label: m.pin_actions_describe() },
        ]}
        onAction={(id) => {
          if (id === "describe") {
            describePin(session, pin);
          } else {
            setIsWiring(true);
          }
        }}
      />
      {isWiring ? (
        <WireToDialog
          pin={pin}
          pinLabel={pinLabel}
          onClose={() => {
            setIsWiring(false);
            focus.returnFocus();
          }}
        />
      ) : undefined}
    </>
  );
}
