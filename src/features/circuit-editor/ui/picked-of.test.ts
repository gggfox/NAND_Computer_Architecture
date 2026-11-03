import { assert, describe, expect, it } from "vitest";

import { EMPTY_CIRCUIT, newChip, pinDef, pinPiece, projectWith } from "~/features/projects";
import type { ChipInstance, PinRef } from "~/features/projects";

import type { Scene } from "../domain/geometry";
import { pinPosition } from "../domain/geometry";
import { EMPTY_SELECTION } from "../domain/selection";
import { pickedOf } from "./picked-of";

const def = pinDef("p", "input", 1);
const pieces: readonly ChipInstance[] = [pinPiece(def), pinPiece(def), pinPiece(def)];
const sceneWith = (instances: readonly ChipInstance[]): Scene => {
  const circuit = { ...EMPTY_CIRCUIT, pins: [def], instances };
  return { project: projectWith("p", [newChip("c", circuit)]), circuit };
};
const refOf = (index: number): PinRef => {
  const piece = pieces[index];
  assert(piece !== undefined);
  return { instanceId: piece.id, pin: 0 };
};
const anchorOf = (scene: Scene, index: number) => {
  const piece = pieces[index];
  assert(piece !== undefined);
  return pinPosition(scene, piece, 0);
};

describe("pickedOf", () => {
  it("anchors each selected pin with its 1-based order", () => {
    const scene = sceneWith(pieces);
    const selection = { ...EMPTY_SELECTION, pins: [refOf(2), refOf(0)] };
    expect(pickedOf(scene, { selection }).picked).toEqual([
      { at: anchorOf(scene, 2), order: 1 },
      { at: anchorOf(scene, 0), order: 2 },
    ]);
  });

  it("skips a pin whose chip is gone and keeps the others' numbers", () => {
    const scene = sceneWith(pieces.filter((piece) => piece !== pieces[1]));
    const selection = { ...EMPTY_SELECTION, pins: [refOf(0), refOf(1), refOf(2)] };
    expect(pickedOf(scene, { selection }).picked?.map((item) => item.order)).toEqual([1, 3]);
  });

  it("gives nothing for no pins or no notice", () => {
    expect(pickedOf(sceneWith(pieces), { selection: EMPTY_SELECTION })).toEqual({});
  });

  it("anchors the pin a bulk refusal blames", () => {
    const scene = sceneWith(pieces);
    const notice = { reason: { type: "OutputToOutput" }, at: refOf(1) } as const;
    const view = pickedOf(scene, { selection: EMPTY_SELECTION, notice });
    expect(view.refusedAt).toEqual(anchorOf(scene, 1));
  });

  it("gives no refusal ring for a plain connection error", () => {
    const notice = { type: "OutputToOutput" } as const;
    const view = pickedOf(sceneWith(pieces), { selection: EMPTY_SELECTION, notice });
    expect(view.refusedAt).toBeUndefined();
  });
});
