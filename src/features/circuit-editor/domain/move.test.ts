/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import { createDemoProject, EMPTY_CIRCUIT } from "~/features/projects";

import { GRID } from "./chip-layout";
import { movesFor, previewPositions, snap } from "./move";

const demo = () => createDemoProject("x").chips[0]?.draft ?? EMPTY_CIRCUIT;

describe("snap", () => {
  it("rounds to the nearest grid point, negatives included", () => {
    expect(snap({ x: 19, y: 21 })).toEqual({ x: 0, y: GRID });
    expect(snap({ x: -19, y: -21 })).toEqual({ x: 0, y: -GRID });
    expect(Object.is(snap({ x: -1, y: 0 }).x, 0)).toBe(true);
  });
});

describe("previewPositions and movesFor", () => {
  it("previews only the selected chips, snapped", () => {
    const circuit = demo();
    const [pieceA, , nand] = circuit.instances;
    assert(pieceA !== undefined && nand !== undefined);
    const ids = new Set([pieceA.id, nand.id]);
    const preview = previewPositions(circuit, ids, { x: 37, y: 3 });
    expect([...preview.values()]).toEqual([
      { x: 40, y: 0 },
      { x: 200, y: 40 },
    ]);
  });

  it("movesFor lists only chips that really changed place", () => {
    const circuit = demo();
    const [pieceA, pieceB] = circuit.instances;
    assert(pieceA !== undefined && pieceB !== undefined);
    const positions = new Map([
      [pieceA.id, { x: 40, y: 0 }],
      [pieceB.id, pieceB.position],
    ]);
    expect(movesFor(circuit, positions)).toEqual([
      { instanceId: pieceA.id, position: { x: 40, y: 0 } },
    ]);
  });
});
