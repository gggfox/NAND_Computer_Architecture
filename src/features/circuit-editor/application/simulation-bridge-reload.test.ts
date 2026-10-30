import { assert, describe, expect, it } from "vitest";

import { createDemoProject, newChip } from "~/features/projects";
import { newChipId, newWireId } from "~/shared/ids";

import { end, notHost, pick } from "../domain/to-netlist-source.fixtures";
import { openCircuit } from "./editor-store";
import { pinsOf, setup } from "./simulation-bridge.fixtures";

describe("connectSimulation reloads", () => {
  it("opening another chip reloads", () => {
    const project = createDemoProject("Two");
    const [first] = project.chips;
    assert(first !== undefined);
    const other = newChip("Other");
    const { editor, sent, simulation } = setup({ ...project, chips: [first, other] });
    sent.length = 0;
    expect(editor.getState().openChip(other.id).ok).toBe(true);
    expect(sent.map((msg) => msg.type)).toEqual(["load"]);
    expect(simulation.getState().error).toBeNull();
  });

  it("a nested chip's save reloads the open chip", () => {
    const { not, host, project } = notHost();
    const { editor, sent } = setup(project);
    expect(editor.getState().chipId).toBe(host.id);
    const chipId = not.chip.id;
    const { dispatch } = editor.getState();
    dispatch({ type: "removeChip", chipId, instanceId: not.nand.id });
    dispatch({
      type: "connectWire",
      chipId,
      wireId: newWireId(),
      from: end(not.pieceA),
      to: end(not.pieceY),
    });
    sent.length = 0;
    expect(dispatch({ type: "saveChip", chipId }).ok).toBe(true);
    expect(sent[0]).toMatchObject({ type: "load", source: { nands: [] } });
  });
});

describe("connectSimulation skips reloads that change no netlist", () => {
  it("moving a chip, renaming and recoloring send nothing", () => {
    const { editor, sent } = setup();
    const { chipId, dispatch } = editor.getState();
    const { pinA } = pinsOf(editor);
    const instanceId = pick(openCircuit(editor.getState()).instances, 0).id;
    sent.length = 0;
    // oxlint-disable-next-line eslint/id-length -- `x` and `y` are coordinate names
    dispatch({ type: "moveChip", chipId, instanceId, position: { x: 7, y: 9 } });
    dispatch({ type: "renameChip", chipId, name: "Renamed" });
    dispatch({ type: "recolorChip", chipId, color: "#abcdef" });
    dispatch({ type: "renamePin", chipId, pinId: pinA.id, name: "Z" });
    expect(sent).toEqual([]);
  });

  it("an unrelated chip's creation and save send nothing", () => {
    const { editor, sent } = setup();
    const created = newChipId();
    sent.length = 0;
    editor
      .getState()
      .dispatch({ type: "createChip", chipId: created, name: "N", color: "#123456" });
    editor.getState().dispatch({ type: "saveChip", chipId: created });
    expect(sent).toEqual([]);
  });
  it("after an engine error the next change reloads", () => {
    const { editor, sent, reply } = setup();
    reply({ type: "error", error: { type: "BadMessage" } });
    sent.length = 0;
    const { chipId, dispatch } = editor.getState();
    dispatch({ type: "renameChip", chipId, name: "Renamed" });
    expect(sent[0]?.type).toBe("load");
  });
});
