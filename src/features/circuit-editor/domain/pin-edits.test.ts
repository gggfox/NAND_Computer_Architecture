import { describe, expect, it } from "vitest";

import { pinDef, pinPiece, piece, projectWith, newChip, wire } from "~/features/projects";
import type { Circuit } from "~/features/projects";
import { newInstanceId, newPinId } from "~/shared/ids";

import { at, draftOf, twoChips } from "./circuit-edits.fixtures";
import { addPin, removePin, renamePin, reorderPin, setPinWidth } from "./pin-edits";

const names = (circuit: Circuit | undefined): readonly string[] =>
  circuit?.pins.map((pin) => pin.name) ?? [];

describe("addPin", () => {
  it("puts an input after the last input, with its piece", () => {
    const { project, host } = twoChips();
    const pin = pinDef("C", "input");
    const instanceId = newInstanceId();
    const result = addPin(project, {
      type: "addPin",
      chipId: host.id,
      pin,
      instanceId,
      position: at(5),
    });
    const draft = result.ok ? draftOf(result.value, host.id) : undefined;
    expect(names(draft)).toEqual(["A", "B", "C", "OUT"]);
    expect(draft?.instances.at(-1)).toEqual({
      id: instanceId,
      kind: { type: "pin", pinId: pin.id },
      position: at(5),
    });
  });

  it("puts an output last", () => {
    const { project, host } = twoChips();
    const result = addPin(project, {
      type: "addPin",
      chipId: host.id,
      pin: pinDef("OUT2", "output"),
      instanceId: newInstanceId(),
      position: at(0),
    });
    expect(names(result.ok ? draftOf(result.value, host.id) : undefined)).toEqual([
      "A",
      "B",
      "OUT",
      "OUT2",
    ]);
  });
});

describe("addPin ordering", () => {
  it("puts the first input first and the first output last", () => {
    const empty = newChip("E");
    const project = projectWith("p", [empty]);
    const first = addPin(project, {
      type: "addPin",
      chipId: empty.id,
      pin: pinDef("OUT", "output"),
      instanceId: newInstanceId(),
      position: at(0),
    });
    const second = first.ok
      ? addPin(first.value, {
          type: "addPin",
          chipId: empty.id,
          pin: pinDef("A", "input"),
          instanceId: newInstanceId(),
          position: at(0),
        })
      : first;
    expect(names(second.ok ? draftOf(second.value, empty.id) : undefined)).toEqual(["A", "OUT"]);
  });
});

describe("addPin rejections", () => {
  it("with an existing pin id is DuplicatePin", () => {
    const { project, host, circuit } = twoChips();
    const existing = circuit.pins[0] ?? pinDef("X", "input");
    const result = addPin(project, {
      type: "addPin",
      chipId: host.id,
      pin: existing,
      instanceId: newInstanceId(),
      position: at(0),
    });
    expect(result).toEqual({ ok: false, error: { type: "DuplicatePin", pinId: existing.id } });
  });

  it("with an existing instance id is DuplicateInstance", () => {
    const { project, host, nand } = twoChips();
    const result = addPin(project, {
      type: "addPin",
      chipId: host.id,
      pin: pinDef("C", "input"),
      instanceId: nand.id,
      position: at(0),
    });
    expect(result).toEqual({
      ok: false,
      error: { type: "DuplicateInstance", instanceId: nand.id },
    });
  });
});

describe("removePin", () => {
  it("removes the definition, its piece and its wires", () => {
    const { project, host, circuit } = twoChips();
    const pinId = circuit.pins[0]?.id ?? newPinId();
    const result = removePin(project, { type: "removePin", chipId: host.id, pinId });
    const draft = result.ok ? draftOf(result.value, host.id) : undefined;
    expect(draft?.pins).toHaveLength(2);
    expect(draft?.instances).toHaveLength(3);
    expect(draft?.wires).toHaveLength(2);
  });
});

describe("removePin without a piece", () => {
  it("removes just the definition and keeps the rest of the circuit", () => {
    const { project, host, circuit } = twoChips();
    const pinId = circuit.pins[0]?.id ?? newPinId();
    const withoutPiece: Circuit = {
      ...circuit,
      instances: circuit.instances.filter(
        (item) => !(item.kind.type === "pin" && item.kind.pinId === pinId),
      ),
    };
    const others = project.chips.filter((chip) => chip.id !== host.id);
    const stripped = { ...project, chips: [{ ...host, draft: withoutPiece }, ...others] };
    const result = removePin(stripped, { type: "removePin", chipId: host.id, pinId });
    const draft = result.ok ? draftOf(result.value, host.id) : undefined;
    expect(draft?.pins.map((pin) => pin.id)).toEqual(
      circuit.pins.filter((pin) => pin.id !== pinId).map((pin) => pin.id),
    );
    expect(draft?.instances).toEqual(withoutPiece.instances);
  });
});

describe("renamePin", () => {
  it("changes only the name", () => {
    const { project, host, circuit } = twoChips();
    const target = circuit.pins[0] ?? pinDef("X", "input");
    const result = renamePin(project, {
      type: "renamePin",
      chipId: host.id,
      pinId: target.id,
      name: "  Alpha ",
    });
    const draft = result.ok ? draftOf(result.value, host.id) : undefined;
    expect(draft?.pins[0]).toEqual({ ...target, name: "Alpha" });
    expect(draft?.wires).toEqual(circuit.wires);
    expect(draft?.instances).toEqual(circuit.instances);
  });

  it("to blanks is EmptyName", () => {
    const { project, host, circuit } = twoChips();
    const pinId = circuit.pins[0]?.id ?? newPinId();
    expect(renamePin(project, { type: "renamePin", chipId: host.id, pinId, name: "  " })).toEqual({
      ok: false,
      error: { type: "EmptyName" },
    });
  });
});

describe("setPinWidth", () => {
  it("drops wires that no longer fit and keeps the rest", () => {
    const { project, host, circuit } = twoChips();
    const pinId = circuit.pins[0]?.id ?? newPinId();
    const result = setPinWidth(project, { type: "setPinWidth", chipId: host.id, pinId, width: 4 });
    const draft = result.ok ? draftOf(result.value, host.id) : undefined;
    expect(draft?.pins[0]?.width).toBe(4);
    expect(draft?.wires).toEqual(circuit.wires.slice(1));
  });

  it("narrowing a bus to 1 bit drops its bit taps", () => {
    const bus = pinDef("D", "input", 4);
    const busPiece = pinPiece(bus);
    const nand = piece({ type: "nand" });
    const circuit: Circuit = {
      pins: [bus],
      instances: [busPiece, nand],
      wires: [
        wire({ instanceId: busPiece.id, pin: 0, bit: 3 }, { instanceId: nand.id, pin: 0 }),
        wire({ instanceId: busPiece.id, pin: 0, bit: 1 }, { instanceId: nand.id, pin: 1 }),
      ],
    };
    const chip = newChip("T", circuit);
    const project = projectWith("p", [chip]);
    const result = setPinWidth(project, {
      type: "setPinWidth",
      chipId: chip.id,
      pinId: bus.id,
      width: 1,
    });
    expect(result.ok ? draftOf(result.value, chip.id)?.wires : undefined).toEqual([]);
  });
});

describe("reorderPin never touches wires", () => {
  it("moves within its direction only", () => {
    const { project, host, circuit } = twoChips();
    const pinId = circuit.pins[1]?.id ?? newPinId();
    const result = reorderPin(project, { type: "reorderPin", chipId: host.id, pinId, toIndex: 0 });
    const draft = result.ok ? draftOf(result.value, host.id) : undefined;
    expect(names(draft)).toEqual(["B", "A", "OUT"]);
    expect(draft?.wires).toBe(circuit.wires);
    expect(draft?.instances).toBe(circuit.instances);
  });

  it("an index outside the direction is PinIndexOutOfRange", () => {
    const { project, host, circuit } = twoChips();
    const pinId = circuit.pins[0]?.id ?? newPinId();
    for (const toIndex of [2, -1, 0.5]) {
      expect(reorderPin(project, { type: "reorderPin", chipId: host.id, pinId, toIndex })).toEqual({
        ok: false,
        error: { type: "PinIndexOutOfRange", index: toIndex },
      });
    }
  });
});

describe("pin lookups", () => {
  it("an unknown pin is PinNotFound for remove, rename, width and reorder", () => {
    const { project, host } = twoChips();
    const chipId = host.id;
    const pinId = newPinId();
    const missing = { ok: false, error: { type: "PinNotFound", pinId } };
    expect(removePin(project, { type: "removePin", chipId, pinId })).toEqual(missing);
    expect(renamePin(project, { type: "renamePin", chipId, pinId, name: "x" })).toEqual(missing);
    expect(setPinWidth(project, { type: "setPinWidth", chipId, pinId, width: 8 })).toEqual(missing);
    expect(reorderPin(project, { type: "reorderPin", chipId, pinId, toIndex: 0 })).toEqual(missing);
  });
});
