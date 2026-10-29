import { newInstanceId, newProjectId, newWireId } from "~/shared/ids";

import type { BuiltinKind, ChipInstance, PinRef, Project, Wire } from "./model";

const ROW_GAP = 80;
const NAND_X = 160;
const NAND_Y = 40;
const OUTPUT_X = 320;
const NAND_OUT_PIN = 2;

const randomSeed = (): number =>
  crypto.getRandomValues(new Uint32Array(1)).reduce((sum, word) => sum + word, 0);

const instance = (builtin: BuiltinKind, left: number, top: number): ChipInstance => ({
  id: newInstanceId(),
  kind: { type: "builtin", builtin },
  /* oxlint-disable-next-line eslint/id-length -- `x` and `y` are coordinate names */
  position: { x: left, y: top },
});

/* oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- branded ids are mutable object types; the value is never mutated */
const wire = (from: PinRef, to: PinRef): Wire => ({
  id: newWireId(),
  from,
  to,
  bitWidth: 1,
  waypoints: [],
});

export const createDemoProject = (name: string): Project => {
  const inputA = instance("input", 0, 0);
  const inputB = instance("input", 0, ROW_GAP);
  const nand = instance("nand", NAND_X, NAND_Y);
  const output = instance("output", OUTPUT_X, NAND_Y);
  return {
    id: newProjectId(),
    name,
    seed: randomSeed(),
    rootCircuit: {
      instances: [inputA, inputB, nand, output],
      wires: [
        wire({ instanceId: inputA.id, pin: 0 }, { instanceId: nand.id, pin: 0 }),
        wire({ instanceId: inputB.id, pin: 0 }, { instanceId: nand.id, pin: 1 }),
        wire({ instanceId: nand.id, pin: NAND_OUT_PIN }, { instanceId: output.id, pin: 0 }),
      ],
    },
    chips: [],
    folders: [],
  };
};
