/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import { createDemoProject } from "~/features/projects";
import { newWireId } from "~/shared/ids";

import { copiesOf, copyOf } from "../domain/clipboard";
import { selectInstances } from "../domain/selection";
import { createEditorStore, openCircuit } from "./editor-store";
import { fakeRepo, SAVED } from "./editor-store.fixtures";

const DELTAS = [
  { x: 0, y: 300 },
  { x: 0, y: 600 },
];

/** A store on the demo, after one `pasteItems` of two copies of the whole circuit. */
const pastedTwice = () => {
  const store = createEditorStore(createDemoProject("x"), fakeRepo(SAVED).repo);
  const circuit = openCircuit(store.getState());
  const ids = circuit.instances.map((item) => item.id);
  const clipboard = copyOf(circuit, selectInstances(ids), 1);
  assert(clipboard !== undefined);
  const batch = copiesOf(clipboard, DELTAS, { target: circuit, newWireId });
  const { chipId, dispatch } = store.getState();
  expect(dispatch({ type: "pasteItems", chipId, ...batch }).ok).toBe(true);
  return { store, before: circuit };
};

describe("several copies in one edit", () => {
  it("add every copy at once", () => {
    const { store, before } = pastedTwice();
    const after = openCircuit(store.getState());
    expect(after.instances).toHaveLength(before.instances.length * 3);
    expect(after.wires).toHaveLength(before.wires.length * 3);
  });

  it("are one undo step: undo removes them all and redo brings them back", () => {
    const { store, before } = pastedTwice();
    const after = openCircuit(store.getState());
    store.getState().undo();
    expect(openCircuit(store.getState()).instances).toEqual(before.instances);
    expect(openCircuit(store.getState()).wires).toHaveLength(before.wires.length);
    store.getState().redo();
    expect(openCircuit(store.getState())).toEqual(after);
  });
});
