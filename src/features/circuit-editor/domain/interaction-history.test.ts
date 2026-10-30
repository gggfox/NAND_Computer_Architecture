import { assert, describe, expect, it } from "vitest";

import type { PinRef } from "~/features/projects";
import { newInstanceId, newWireId } from "~/shared/ids";

import { withoutOverlays } from "./interaction";
import type { BitPick, InteractionState } from "./interaction";
import { afterHistory } from "./interaction-history";
import { screen, setup } from "./interaction.fixtures";

const AT = screen(0, 0);

const pickOf = (armed: PinRef, target: PinRef): BitPick => ({
  armed,
  target,
  bus: "target",
  bits: [0, 1],
  screen: AT,
});

/** The demo, and `afterHistory` run on its scene over the given overlays. */
const history = () => {
  const demo = setup();
  const after = (overrides: Partial<InteractionState>): InteractionState =>
    afterHistory({ ...demo.state, ...overrides }, demo.context.scene);
  const [wire] = demo.circuit.wires;
  assert(wire !== undefined);
  return { ...demo, after, wire };
};

describe("afterHistory", () => {
  it("afterHistory drops armed, bitPick, bends and menus whose targets are gone", () => {
    const { state, nand, pieceA, after } = history();
    const gone = newInstanceId();
    const goneWire = newWireId();
    const missing = after({
      armed: { end: { instanceId: gone, pin: 0 }, legal: new Set() },
      bitPick: pickOf({ instanceId: gone, pin: 0 }, { instanceId: nand.id, pin: 0 }),
      bends: goneWire,
      menu: { kind: "wire", wireId: goneWire, screen: AT },
    });
    expect(missing).toEqual(state);
    expect(after({ menu: { kind: "chip", instanceId: gone, screen: AT } }).menu).toBeUndefined();
    const targetGone = after({
      bitPick: pickOf({ instanceId: pieceA.id, pin: 0 }, { instanceId: gone, pin: 0 }),
    });
    expect(targetGone.bitPick).toBeUndefined();
  });

  it("keeps what is still there and recomputes the armed pin's legal targets", () => {
    const { nand, pieceA, after, wire } = history();
    const kept = after({
      armed: { end: { instanceId: pieceA.id, pin: 0 }, color: "teal", legal: new Set(["stale"]) },
      bitPick: pickOf({ instanceId: pieceA.id, pin: 0 }, { instanceId: nand.id, pin: 0 }),
      bends: wire.id,
      menu: { kind: "wire", wireId: wire.id, screen: AT },
    });
    expect(kept.armed?.color).toBe("teal");
    // Recomputed: every input of the demo is driven, so nothing is legal from A.
    expect(kept.armed?.legal).toEqual(new Set());
    expect(kept.bitPick).toBeDefined();
    expect(kept.bends).toBe(wire.id);
    expect(kept.menu).toEqual({ kind: "wire", wireId: wire.id, screen: AT });
  });

  it("keeps the canvas menu and a chip menu whose chip is there", () => {
    const { nand, after } = history();
    const canvas = { kind: "canvas", screen: AT } as const;
    expect(after({ menu: canvas }).menu).toEqual(canvas);
    const chip = { kind: "chip", instanceId: nand.id, screen: AT } as const;
    expect(after({ menu: chip }).menu).toEqual(chip);
  });
});

describe("withoutOverlays", () => {
  it("closes the menu, card and bit picker but keeps the armed pin", () => {
    const { state, pieceA, nand } = setup();
    const armed = { end: { instanceId: pieceA.id, pin: 0 }, legal: new Set<string>() };
    const open: InteractionState = {
      ...state,
      armed,
      menu: { kind: "canvas", screen: AT },
      card: { instanceId: nand.id, pin: 0, screen: AT, pinned: true },
      bitPick: pickOf(armed.end, { instanceId: nand.id, pin: 0 }),
    };
    expect(withoutOverlays(open)).toEqual({ ...state, armed });
  });
});
