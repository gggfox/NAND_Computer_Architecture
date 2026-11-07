import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { openCircuit } from "~/features/circuit-editor";

import { OutputsReader, readingsOf } from "./OutputsReader";
import { createTestSession } from "./structure-session.fixtures";

describe("OutputsReader", () => {
  it("renders a Read outputs button", () => {
    const markup = renderToStaticMarkup(<OutputsReader session={createTestSession()} />);
    expect(markup).toContain("Read outputs");
  });

  it("lists every output pin with its level, or no level when unknown", () => {
    const session = createTestSession();
    const circuit = openCircuit(session.editor.getState());
    const output = circuit.pins.find((pin) => pin.direction === "output");
    expect(output).toBeDefined();
    const pinId = output?.id;
    if (pinId === undefined) {
      return;
    }
    expect(readingsOf(circuit, new Map([[pinId, 1]]))).toEqual([{ name: output?.name, value: 1 }]);
    expect(readingsOf(circuit, new Map())).toEqual([{ name: output?.name, value: undefined }]);
  });

  it("speaks all outputs once through the canvas announcement", () => {
    const session = createTestSession();
    const circuit = openCircuit(session.editor.getState());
    const { send } = session.interaction.store.getState();
    send({
      type: "command",
      command: { type: "readOutputs", readings: readingsOf(circuit, new Map()) },
    });
    const said = session.interaction.store.getState().announcement?.announcement;
    expect(said?.type).toBe("outputs");
  });
});
