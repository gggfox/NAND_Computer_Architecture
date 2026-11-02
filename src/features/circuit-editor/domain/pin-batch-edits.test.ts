import { describe, expect, it } from "vitest";

import { pinDef } from "~/features/projects";
import { newInstanceId } from "~/shared/ids";

import { at, draftOf, twoChips } from "./circuit-edits.fixtures";
import { createHistory, pushHistory, undo } from "./history";
import { addPins } from "./pin-batch-edits";
import { applyAction } from "./reducer";

const entries = () =>
  ["C", "D", "E"].map((name, index) => ({
    pin: pinDef(name, "input"),
    instanceId: newInstanceId(),
    position: at(index + 1),
  }));

describe("addPins", () => {
  it("adds the pins after the last input, in order, with pieces at the given positions", () => {
    const { project, host, circuit } = twoChips();
    const pins = entries();
    const result = addPins(project, { type: "addPins", chipId: host.id, pins });
    const draft = result.ok ? draftOf(result.value, host.id) : undefined;
    expect(draft?.pins.map((pin) => pin.name)).toEqual(["A", "B", "C", "D", "E", "OUT"]);
    expect(draft?.instances.slice(circuit.instances.length)).toEqual(
      pins.map(({ pin, instanceId, position }) => ({
        id: instanceId,
        kind: { type: "pin", pinId: pin.id },
        position,
      })),
    );
  });
});

describe("addPins as an action", () => {
  it("is one history step", () => {
    const { project, host } = twoChips();
    const result = applyAction(project, { type: "addPins", chipId: host.id, pins: entries() });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const history = pushHistory(createHistory(project), result.value);
      expect(undo(history).present).toBe(project);
    }
  });
});

describe("addPins failures", () => {
  it("fails on an empty list", () => {
    const { project, host } = twoChips();
    expect(addPins(project, { type: "addPins", chipId: host.id, pins: [] })).toEqual({
      ok: false,
      error: { type: "NothingToAdd" },
    });
  });

  it("fails on a repeated pin id", () => {
    const { project, host } = twoChips();
    const [first, second] = entries();
    const pins =
      first === undefined || second === undefined ? [] : [first, { ...second, pin: first.pin }];
    const result = addPins(project, { type: "addPins", chipId: host.id, pins });
    expect(!result.ok && result.error.type).toBe("DuplicatePin");
  });

  it("fails on a repeated instance id", () => {
    const { project, host } = twoChips();
    const [first, second] = entries();
    const pins =
      first === undefined || second === undefined
        ? []
        : [first, { ...second, instanceId: first.instanceId }];
    const result = addPins(project, { type: "addPins", chipId: host.id, pins });
    expect(!result.ok && result.error.type).toBe("DuplicateInstance");
  });
});
