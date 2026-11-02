/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import { createDemoProject, EMPTY_CIRCUIT, piece } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import type { PinId } from "~/shared/ids";
import { newInstanceId, newWireId } from "~/shared/ids";

import { announcementText, chipLabel } from "./announcements";
import type { Scene } from "./geometry";
import type { KnownLevels } from "./signals";

const known: KnownLevels = { inputs: new Map<PinId, number>(), outputs: new Map<PinId, number>() };

const demo = () => {
  const project = createDemoProject("x");
  const draft = project.chips[0]?.draft ?? EMPTY_CIRCUIT;
  const second = piece({ type: "nand" }, { x: 480, y: 0 });
  const split = piece({ type: "split", width: 4 }, { x: 480, y: 200 });
  const circuit = { ...draft, instances: [...draft.instances, second, split] };
  const [pieceA, , nand] = circuit.instances;
  assert(pieceA !== undefined && nand !== undefined);
  const scene: Scene = { project, circuit };
  return { scene, pieceA, nand, second, split };
};

describe("chipLabel", () => {
  it("names pin pieces by pin, NANDs and other parts by number", () => {
    const { scene, pieceA, nand, second, split } = demo();
    expect(chipLabel(scene, pieceA.id)).toBe("A");
    expect(chipLabel(scene, nand.id)).toBe("NAND gate 1");
    expect(chipLabel(scene, second.id)).toBe("NAND gate 2");
    expect(chipLabel(scene, split.id)).toBe("Split 4 1");
    expect(chipLabel(scene, newInstanceId())).toBe("");
  });
});

describe("announcementText", () => {
  it("says what was selected, moved, deleted or cleared", () => {
    const { scene, nand } = demo();
    const say = (announcement: Parameters<typeof announcementText>[2]) =>
      announcementText(scene, known, announcement);
    expect(say({ type: "selected", instanceIds: [nand.id], wires: 0 })).toBe(
      "NAND gate 1 selected",
    );
    expect(say({ type: "selected", instanceIds: [nand.id], wires: 1 })).toBe("Items selected: 2");
    expect(say({ type: "selected", instanceIds: [], wires: 1 })).toBe("Items selected: 1");
    expect(say({ type: "cleared" })).toBe("Selection cleared");
    expect(say({ type: "moved", count: 2 })).toBe("Chips moved: 2");
    expect(say({ type: "deleted", count: 3 })).toBe("Items deleted: 3");
    expect(say({ type: "tool", tool: "pan" })).toBe("Dragging the canvas pans");
    expect(say({ type: "tool", tool: "select" })).toBe("Dragging the canvas selects");
  });

  it("reads a pin: name, chip, value and connection count", () => {
    const { scene, nand } = demo();
    expect(announcementText(scene, known, { type: "pin", instanceId: nand.id, pin: 0 })).toBe(
      "Pin a of NAND gate 1: ?. Connections: 1",
    );
    expect(announcementText(scene, known, { type: "pin", instanceId: nand.id, pin: 9 })).toBe("");
  });

  it("says when a pin is armed, a wire added and wiring cancelled", () => {
    const { scene, nand } = demo();
    const say = (announcement: Parameters<typeof announcementText>[2]) =>
      announcementText(scene, known, announcement);
    expect(say({ type: "armed", instanceId: nand.id, pin: 2 })).toBe(
      "out of NAND gate 1 ready to wire",
    );
    expect(say({ type: "armed", instanceId: nand.id, pin: 9 })).toBe("");
    expect(say({ type: "wired" })).toBe("Wire added");
    expect(say({ type: "disarmed" })).toBe("Wiring cancelled");
    expect(say({ type: "bends", active: true })).toBe(
      "Moving bends. ] and [ choose a segment, arrows move it, Escape finishes.",
    );
    expect(say({ type: "bends", active: false })).toBe("Bends done");
  });

  it("rejects unknown announcements", () => {
    const { scene } = demo();
    /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Deliberately violates the exhaustive union to hit assertNever */
    const bogus = JSON.parse('{"type":"bogus"}') as never;
    expect(() => announcementText(scene, known, bogus)).toThrow("Unexpected value");
  });
});

describe("the refused announcement", () => {
  it("says why a connection was refused", () => {
    const { scene, nand } = demo();
    const reason = { type: "InputAlreadyDriven", instanceId: nand.id } as const;
    expect(announcementText(scene, known, { type: "refused", reason })).toBe(
      m.editor_error_input_already_driven(),
    );
  });
});

describe("the wire selected announcement", () => {
  it("names a keyboard-selected wire by its ends, or says nothing for a missing wire", () => {
    const { scene } = demo();
    const [intoA] = scene.circuit.wires;
    assert(intoA !== undefined);
    const say = (announcement: Parameters<typeof announcementText>[2]) =>
      announcementText(scene, known, announcement);
    expect(say({ type: "wireSelected", wireId: intoA.id })).toBe(
      "Wire from A of A to a of NAND gate 1",
    );
    expect(say({ type: "wireSelected", wireId: newWireId() })).toBe("");
    const dangling = { ...intoA, to: { ...intoA.to, pin: 9 } };
    const broken: Scene = { ...scene, circuit: { ...scene.circuit, wires: [dangling] } };
    expect(announcementText(broken, known, { type: "wireSelected", wireId: intoA.id })).toBe("");
  });

  it("says when placing starts, stops and places a part", () => {
    const { scene } = demo();
    const split = { type: "split", width: 4 } as const;
    expect(announcementText(scene, known, { type: "placing", kind: split })).toBe(
      "Placing Split 4. Tap or press Escape to stop.",
    );
    expect(announcementText(scene, known, { type: "placing", kind: undefined })).toBe(
      "Stopped placing.",
    );
    expect(announcementText(scene, known, { type: "placed", kind: { type: "nand" } })).toBe(
      "Placed NAND.",
    );
  });
});
