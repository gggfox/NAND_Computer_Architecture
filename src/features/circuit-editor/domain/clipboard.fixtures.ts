/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert } from "vitest";

import { newChip, projectWith } from "~/features/projects";
import type { Circuit, Point, Project } from "~/features/projects";
import type { ChipId } from "~/shared/ids";
import { newWireId } from "~/shared/ids";

import { copyOf, pastedFrom } from "./clipboard";
import type { PasteTarget } from "./clipboard";
import { applyAction } from "./reducer";
import { selectInstances } from "./selection";

/** A paste into `circuit`, moved by `delta`, with real wire ids. */
export const targetOf = (circuit: Circuit, delta: Point): PasteTarget => ({
  delta,
  target: circuit,
  newWireId,
});

/** All of `circuit`, copied and moved by `delta`. */
export const pastedAll = (circuit: Circuit, delta: { x: number; y: number }) => {
  const clipboard = copyOf(circuit, selectInstances(circuit.instances.map((item) => item.id)), 1);
  assert(clipboard !== undefined);
  return pastedFrom(clipboard, targetOf(circuit, delta));
};

/** A project with one chip whose draft is `circuit`. */
export const chipWith = (circuit: Circuit) => {
  const chip = newChip("P", circuit);
  return { project: projectWith("p", [chip]), chipId: chip.id };
};

/** Pastes all of `circuit` into `chipId`, 400 units down. */
export const pasteAll = (project: Project, chipId: ChipId, circuit: Circuit) =>
  applyAction(project, { type: "pasteItems", chipId, ...pastedAll(circuit, { x: 0, y: 400 }) });
