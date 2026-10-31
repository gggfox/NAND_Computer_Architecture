/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { newChip, piece, pinDef, projectWith, replaceChip } from "~/features/projects";
import type { ChipInstance, Wire } from "~/features/projects";

import { link, NAND_A, NAND_OUT, nandAt } from "./routing/routing.fixtures";

const LEFT = 0;
const RIGHT = 480;
const MIDDLE = 240;
const FAR = 400;
const [from, to] = [nandAt(LEFT, 0), nandAt(RIGHT, 0)];
/** From `from` to `to`; a chip at (240, 0) or a tall pin piece near (200, 0) lies across it. */
export const crossing = (): Wire => link([from, NAND_OUT], [to, NAND_A]);
/** Far below: a wire already running through a chip before any edit. */
const [farFrom, farTo, farBlocker] = [nandAt(LEFT, FAR), nandAt(RIGHT, FAR), nandAt(MIDDLE, FAR)];
export const farBlocked = (): Wire => link([farFrom, NAND_OUT], [farTo, NAND_A]);
export const chips: readonly ChipInstance[] = [from, to, farFrom, farTo, farBlocker];

const manyPins = Array.from({ length: 8 }, (_unused, index) =>
  pinDef(`i${String(index)}`, "input"),
);

/** A saved child with one pin whose draft has eight, placed above the crossing wire. */
export const savingProject = () => {
  const child = newChip(
    "child",
    { pins: manyPins.slice(0, 1), instances: [], wires: [] },
    { saved: true },
  );
  const instance = piece({ type: "custom", chipId: child.id }, { x: 200, y: -120 });
  const [wire, far] = [crossing(), farBlocked()];
  const parent = newChip("parent", {
    pins: [],
    instances: [...chips, instance],
    wires: [wire, far],
  });
  const bystander = newChip("other", { pins: [], instances: chips, wires: [farBlocked()] });
  const grown = { ...child, draft: { ...child.draft, pins: manyPins } };
  const project = replaceChip(projectWith("p", [child, parent, bystander]), grown);
  return { project, child, parent, bystander, wire, far };
};

/**
 * A saved child placed on a wire whose stored (automatic, non-empty) route already runs through
 * it; the child's draft grows, but the wire was blocked before the save.
 */
export const alreadyBlockedSave = () => {
  const child = newChip(
    "child",
    { pins: manyPins.slice(0, 1), instances: [], wires: [] },
    { saved: true },
  );
  const instance = piece({ type: "custom", chipId: child.id }, { x: 200, y: 0 });
  const wire = {
    ...crossing(),
    waypoints: [
      { x: 300, y: 40 },
      { x: 300, y: 20 },
    ],
  };
  const parent = newChip("parent", { pins: [], instances: [from, to, instance], wires: [wire] });
  const grown = { ...child, draft: { ...child.draft, pins: manyPins } };
  const project = replaceChip(projectWith("p", [parent, child]), grown);
  return { project, child, parent, wire };
};
