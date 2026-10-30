import { assert, describe, expect, it } from "vitest";

import { createDemoProject, piece, wire } from "~/features/projects";
import type { Project } from "~/features/projects";

import { pinLevelKey } from "../domain/signals";
import { openCircuit } from "./editor-store";
import { pinsOf, placeNand, setup } from "./simulation-bridge.fixtures";

/** The demo with its NAND's `b` input fed by a clock instead of input B. */
const clockedDemo = (): Project => {
  const project = createDemoProject("Clocked");
  const [chip] = project.chips;
  assert(chip !== undefined);
  const clockPiece = piece({ type: "clock" });
  const nand = chip.draft.instances.find((item) => item.kind.type === "nand");
  assert(nand !== undefined);
  const draft = {
    ...chip.draft,
    instances: [...chip.draft.instances, clockPiece],
    wires: [
      ...chip.draft.wires.filter((item) => !(item.to.instanceId === nand.id && item.to.pin === 1)),
      wire({ instanceId: clockPiece.id, pin: 0 }, { instanceId: nand.id, pin: 1 }),
    ],
  };
  return { ...project, chips: [{ ...chip, draft }] };
};

describe("connectSimulation loading", () => {
  it("loads the open chip's netlist and replays inputs per bit", () => {
    const { sent, project } = setup();
    expect(sent[0]).toMatchObject({ type: "load", seed: project.seed });
    expect(sent.slice(1)).toEqual([
      { type: "setInput", index: 0, value: 0 },
      { type: "setInput", index: 1, value: 0 },
    ]);
  });

  it("a circuit with a clock simulates instead of erroring", () => {
    const { simulation, sent } = setup(clockedDemo());
    expect(simulation.getState().error).toBeNull();
    expect(sent[0]?.type).toBe("load");
    expect(sent.slice(1)).toEqual([
      { type: "setInput", index: 0, value: 0 },
      { type: "setInput", index: 1, value: 0 },
    ]);
  });
});

describe("connectSimulation inputs and outputs", () => {
  it("forwards only changed input bits, following the pins", () => {
    const { editor, sent } = setup();
    const { pinB } = pinsOf(editor);
    sent.length = 0;
    editor.getState().setInput(pinB.id, 1);
    expect(sent).toEqual([{ type: "setInput", index: 1, value: 1 }]);
  });

  it("replays input values at their pins' new bits after a reorder", () => {
    const { editor, sent } = setup();
    const { pinB } = pinsOf(editor);
    editor.getState().setInput(pinB.id, 1);
    sent.length = 0;
    editor.getState().dispatch({
      type: "reorderPin",
      chipId: editor.getState().chipId,
      pinId: pinB.id,
      toIndex: 0,
    });
    expect(sent[0]?.type).toBe("load");
    expect(sent.slice(1)).toEqual([
      { type: "setInput", index: 0, value: 1 },
      { type: "setInput", index: 1, value: 0 },
    ]);
  });

  it("keeps the outputs Map while the values are equal", () => {
    const { simulation, reply } = setup();
    reply({ type: "state", tick: 1, stable: true, outputs: [1], clock: 0, running: true });
    const first = simulation.getState().outputs;
    reply({ type: "state", tick: 2, stable: true, outputs: [1], clock: 1, running: true });
    expect(simulation.getState().outputs).toBe(first);
    reply({ type: "state", tick: 3, stable: true, outputs: [0], clock: 0, running: true });
    expect(simulation.getState().outputs).not.toBe(first);
  });

  it("unpacks outputs per pin and mirrors the clock", () => {
    const { editor, simulation, reply } = setup();
    const { pinOut } = pinsOf(editor);
    reply({ type: "state", tick: 3, stable: true, outputs: [1], clock: 1, running: true });
    expect(simulation.getState().outputs.get(pinOut.id)).toBe(1);
    expect(simulation.getState()).toMatchObject({ clock: 1, running: true });
    expect(simulation.getState().error).toBeNull();
  });
});

/** A demo reply: NAND output low, inputs A and B high. */
const probedState = (tick: number) =>
  ({ type: "state", tick, stable: true, outputs: [0, 1, 1], clock: 0, running: false }) as const;

const nandOf = (editor: ReturnType<typeof setup>["editor"]) => {
  const nand = openCircuit(editor.getState()).instances.find((item) => item.kind.type === "nand");
  assert(nand !== undefined);
  return nand;
};

describe("connectSimulation probes", () => {
  it("loads every probed signal once, after the open chip's outputs", () => {
    const [load] = setup().sent;
    assert(load?.type === "load");
    expect(load.source.outputs).toEqual([
      { kind: "nand", index: 0 },
      { kind: "input", index: 0 },
      { kind: "input", index: 1 },
    ]);
  });

  it("reports pin levels and keeps their Map while the values are equal", () => {
    const { editor, simulation, reply } = setup();
    const nand = nandOf(editor);
    reply(probedState(1));
    const { levels } = simulation.getState();
    expect(levels.get(pinLevelKey(nand.id, 0))).toBe(1);
    expect(levels.get(pinLevelKey(nand.id, 2))).toBe(0);
    reply(probedState(2));
    expect(simulation.getState().levels).toBe(levels);
  });

  it("forgets pin levels while the circuit cannot be compiled", () => {
    const { editor, simulation, reply } = setup();
    reply(probedState(1));
    expect(simulation.getState().levels.size).toBeGreaterThan(0);
    const wireId = openCircuit(editor.getState()).wires[0]?.id;
    assert(wireId !== undefined);
    editor.getState().dispatch({ type: "removeWire", chipId: editor.getState().chipId, wireId });
    expect(simulation.getState().levels.size).toBe(0);
  });
});

describe("connectSimulation clock", () => {
  it("clock controls send play, pause, step and a clamped speed", () => {
    const { clock, sent } = setup();
    sent.length = 0;
    clock.play();
    clock.pause();
    clock.step();
    clock.setSpeed(5000);
    clock.setSpeed(0);
    expect(sent).toEqual([
      { type: "play" },
      { type: "pause" },
      { type: "step" },
      { type: "setSpeed", stepsPerSecond: 1000 },
      { type: "setSpeed", stepsPerSecond: 0.5 },
    ]);
  });

  it("starts paused at the default speed", () => {
    const { simulation } = setup();
    expect(simulation.getState()).toMatchObject({ clock: 0, running: false, stepsPerSecond: 4 });
  });

  it("a reload while playing never pauses", () => {
    const { editor, sent, clock } = setup();
    clock.play();
    sent.length = 0;
    editor.getState().dispatch(placeNand(editor));
    editor.getState().undo();
    expect(sent.map((msg) => msg.type)).not.toContain("pause");
  });
});

describe("connectSimulation speed", () => {
  it("stores the clamped speed", () => {
    const { clock, simulation } = setup();
    clock.setSpeed(5000);
    expect(simulation.getState().stepsPerSecond).toBe(1000);
    clock.setSpeed(0);
    expect(simulation.getState().stepsPerSecond).toBe(0.5);
  });

  it("a non-finite speed keeps the current speed", () => {
    const { clock, simulation, sent } = setup();
    clock.setSpeed(8);
    sent.length = 0;
    for (const speed of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      clock.setSpeed(speed);
      expect(simulation.getState().stepsPerSecond).toBe(8);
    }
    expect(sent).toEqual([
      { type: "setSpeed", stepsPerSecond: 8 },
      { type: "setSpeed", stepsPerSecond: 8 },
      { type: "setSpeed", stepsPerSecond: 8 },
    ]);
  });
});

describe("connectSimulation errors", () => {
  it("netlist errors are reported and stale replies ignored", () => {
    const { editor, simulation, sent, reply } = setup();
    const { pinA } = pinsOf(editor);
    editor.getState().dispatch(placeNand(editor));
    expect(simulation.getState().error?.type).toBe("UnconnectedPin");
    sent.length = 0;
    reply({ type: "state", tick: 1, stable: true, outputs: [0], clock: 1, running: true });
    editor.getState().setInput(pinA.id, 1);
    expect(simulation.getState().outputs.size).toBe(0);
    expect(simulation.getState().clock).toBe(0);
    expect(sent).toEqual([]);
  });

  it("reloads and recovers when an invalid edit is undone", () => {
    const { editor, simulation, sent, reply } = setup();
    const { pinOut } = pinsOf(editor);
    editor.getState().dispatch(placeNand(editor));
    sent.length = 0;
    editor.getState().undo();
    expect(sent[0]?.type).toBe("load");
    reply({ type: "state", tick: 2, stable: true, outputs: [1], clock: 0, running: false });
    expect(simulation.getState().outputs.get(pinOut.id)).toBe(1);
    expect(simulation.getState().error).toBeNull();
  });

  it("surfaces engine errors and stops listening once disconnected", () => {
    const { simulation, reply, disconnect, listeners } = setup();
    reply({ type: "error", error: { type: "WorkerFailed" } });
    expect(simulation.getState().outputs.size).toBe(0);
    expect(simulation.getState().error).toEqual({ type: "WorkerFailed" });
    disconnect();
    expect(listeners.size).toBe(0);
  });
});
