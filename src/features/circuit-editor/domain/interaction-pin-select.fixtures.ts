/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert } from "vitest";

import { piece } from "~/features/projects";
import type { ChipInstance, PinRef, Point } from "~/features/projects";
import { newWireId } from "~/shared/ids";

import { buildIndex } from "./hit-test";
import type { InteractionContext, InteractionState } from "./interaction";
import { NONE, command, screen, setup } from "./interaction.fixtures";
import { selectInstances } from "./selection";

/** Where the grid starts and how far apart its NANDs are, in world units. */
const ORIGIN = { x: 400, y: 500 } as const;
const GAP = { x: 200, y: 150 } as const;
/** How far below a NAND's top its input `a` sits. */
const PIN_A_DY = 20;

export const SHIFT = { ...NONE, shift: true };
export const COLUMNS = 5;
export const ROWS = 3;
/** The demo's NAND and the fifteen more in the grid. */
export const PINS = COLUMNS * ROWS + 1;

export const pinOf = (chip: ChipInstance): PinRef => ({ instanceId: chip.id, pin: 0 });

/** Where a NAND's input `a` is on screen. */
export const where = (chip: ChipInstance): Point =>
  screen(chip.position.x, chip.position.y + PIN_A_DY);

/** A pinned card on a NAND's input `a`. */
export const cardOn = (chip: ChipInstance | undefined) => {
  assert(chip !== undefined);
  return { instanceId: chip.id, pin: 0, screen: where(chip), pinned: true };
};

/** The scene `circuit` as a context with its own spatial index. */
export const contextOf = (
  base: InteractionContext,
  circuit: InteractionContext["scene"]["circuit"],
): InteractionContext => {
  const scene = { ...base.scene, circuit };
  return { ...base, scene, index: () => buildIndex(scene) };
};

/**
 * The demo without wires plus 15 more NANDs in three rows, listed bottom row first, so reading
 * order differs from instance order. `reading` is that order for the `a` pins.
 */
export const grid = () => {
  const base = setup();
  const extras = Array.from({ length: COLUMNS * ROWS }, (_unused, index) =>
    piece(
      { type: "nand" },
      {
        x: ORIGIN.x + (index % COLUMNS) * GAP.x,
        y: ORIGIN.y - Math.floor(index / COLUMNS) * GAP.y,
      },
    ),
  );
  const circuit = { ...base.circuit, instances: [...base.circuit.instances, ...extras], wires: [] };
  const context = { ...contextOf(base.context, circuit), newWireId: () => newWireId() };
  const chips = [base.nand, ...extras];
  const rows = Array.from({ length: ROWS }, (_unused, row) =>
    extras.slice(row * COLUMNS, (row + 1) * COLUMNS),
  );
  const reading = [base.nand, ...rows.toReversed().flat()];
  return { ...base, context, circuit, chips, reading };
};

export const allSelected = (
  state: InteractionState,
  chips: readonly ChipInstance[],
): InteractionState => ({ ...state, selection: selectInstances(chips.map((chip) => chip.id)) });

/** All 16 `a` pins picked with `a`, in reading order, with the chips still selected. */
export const picked = (rig: ReturnType<typeof grid>): InteractionState => {
  const { context, state, chips } = rig;
  const card = cardOn(chips[0]);
  const result = command({ ...allSelected(state, chips), card }, context, {
    type: "selectPinOnAll",
  });
  const { card: _card, ...rest } = result.state;
  return rest;
};
