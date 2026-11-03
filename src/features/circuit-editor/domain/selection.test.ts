/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { createDemoProject, EMPTY_CIRCUIT } from "~/features/projects";
import { newInstanceId, newWireId } from "~/shared/ids";

import {
  addInstances,
  EMPTY_SELECTION,
  inBox,
  inLasso,
  isEmpty,
  prune,
  selectInstances,
  selectWire,
  toggleInstance,
  toggleWire,
  withInnerWires,
  withPins,
} from "./selection";

const [first, second, third] = [newInstanceId(), newInstanceId(), newInstanceId()];
const chips = [
  { instanceId: first, rect: { x: 0, y: 0, width: 40, height: 40 } },
  { instanceId: second, rect: { x: 100, y: 0, width: 120, height: 80 } },
  { instanceId: third, rect: { x: 0, y: 200, width: 40, height: 40 } },
];

describe("selection sets", () => {
  it("select, toggle, add and empty", () => {
    const wireId = newWireId();
    expect(isEmpty(EMPTY_SELECTION)).toBe(true);
    const one = selectInstances([first]);
    expect([...toggleInstance(one, second).instances]).toEqual([first, second]);
    expect(toggleInstance(one, first).instances.size).toBe(0);
    expect([...addInstances(one, [first, third]).instances]).toEqual([first, third]);
    expect(isEmpty(selectWire(wireId))).toBe(false);
    expect(toggleWire(selectWire(wireId), wireId).wires.size).toBe(0);
  });

  it("keeps pins through toggles and additions, and drops them on a new selection", () => {
    const pins = [{ instanceId: first, pin: 0 }];
    const picked = withPins(selectInstances([first]), pins);
    expect(picked.pins).toEqual(pins);
    expect(toggleInstance(picked, second).pins).toBe(pins);
    expect(toggleWire(picked, newWireId()).pins).toBe(pins);
    expect(addInstances(picked, [third]).pins).toBe(pins);
    expect(selectInstances([first]).pins).toEqual([]);
    expect(selectWire(newWireId()).pins).toEqual([]);
    expect(EMPTY_SELECTION.pins).toEqual([]);
  });

  it("counts pins as something selected", () => {
    expect(isEmpty(withPins(EMPTY_SELECTION, [{ instanceId: first, pin: 0 }]))).toBe(false);
  });
});

describe("box and lasso", () => {
  it("a box selects chips whose centre is inside it", () => {
    // Covers all of the first chip and the left half of the second (its centre is at x = 160).
    expect(inBox(chips, { x: -10, y: -10, width: 150, height: 100 })).toEqual([first]);
    expect(inBox(chips, { x: -10, y: -10, width: 200, height: 100 })).toEqual([first, second]);
  });

  it("a concave lasso selects by centre", () => {
    // A U shape around the first and second chips' centres, with the notch over x 40..140.
    const lasso = [
      { x: -10, y: -10 },
      { x: 40, y: -10 },
      { x: 40, y: 30 },
      { x: 140, y: 30 },
      { x: 140, y: -10 },
      { x: 240, y: -10 },
      { x: 240, y: 100 },
      { x: -10, y: 100 },
    ];
    expect(inLasso(chips, lasso)).toEqual([first, second]);
    expect(inLasso(chips, [])).toEqual([]);
  });
});

describe("selection against a circuit", () => {
  const project = createDemoProject("x");
  const circuit = project.chips[0]?.draft ?? EMPTY_CIRCUIT;
  const scene = { project, circuit };
  const ids = circuit.instances.map((item) => item.id);

  it("withInnerWires adds wires whose two ends are selected", () => {
    const [idA, , idNand] = ids;
    const selection = withInnerWires(
      circuit,
      selectInstances([idA, idNand].flatMap((id) => (id ? [id] : []))),
    );
    expect([...selection.wires]).toEqual([circuit.wires[0]?.id]);
  });

  it("prune drops missing ids, and returns the same selection when nothing is missing", () => {
    const kept = selectInstances(ids);
    expect(prune(kept, scene)).toBe(kept);
    const stale = addInstances(selectWire(newWireId()), [newInstanceId(), ...ids.slice(0, 1)]);
    expect(prune(stale, scene)).toEqual({
      instances: new Set(ids.slice(0, 1)),
      wires: new Set(),
      pins: [],
    });
  });

  it("prune drops pins whose chip is gone or whose pin the chip does not have", () => {
    const [idA, , idNand] = ids;
    const good = [
      { instanceId: idNand ?? first, pin: 2 },
      { instanceId: idA ?? first, pin: 0 },
    ];
    const kept = withPins(selectInstances(ids), good);
    expect(prune(kept, scene)).toBe(kept);
    const stale = withPins(kept, [
      ...good,
      { instanceId: newInstanceId(), pin: 0 },
      { instanceId: idNand ?? first, pin: 9 },
    ]);
    expect(prune(stale, scene).pins).toEqual(good);
  });
});
