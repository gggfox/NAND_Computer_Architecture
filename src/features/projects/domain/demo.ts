import { newChip, pinDef, pinPiece, piece, projectWith, wire } from "./builders";
import type { Project } from "./model";

const ROW_GAP = 80;
const NAND_X = 160;
const NAND_Y = 40;
const OUTPUT_X = 320;
const NAND_OUT_PIN = 2;

const randomSeed = (): number =>
  crypto.getRandomValues(new Uint32Array(1)).reduce((sum, word) => sum + word, 0);

/** One draft-only chip: inputs A and B through a NAND to OUT. */
export const createDemoProject = (name: string): Project => {
  const pinA = pinDef("A", "input");
  const pinB = pinDef("B", "input");
  const pinOut = pinDef("OUT", "output");
  /* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
  const inputA = pinPiece(pinA, { x: 0, y: 0 });
  const inputB = pinPiece(pinB, { x: 0, y: ROW_GAP });
  const nand = piece({ type: "nand" }, { x: NAND_X, y: NAND_Y });
  const output = pinPiece(pinOut, { x: OUTPUT_X, y: NAND_Y });
  /* oxlint-enable eslint/id-length */
  const draft = {
    pins: [pinA, pinB, pinOut],
    instances: [inputA, inputB, nand, output],
    wires: [
      wire({ instanceId: inputA.id, pin: 0 }, { instanceId: nand.id, pin: 0 }),
      wire({ instanceId: inputB.id, pin: 0 }, { instanceId: nand.id, pin: 1 }),
      wire({ instanceId: nand.id, pin: NAND_OUT_PIN }, { instanceId: output.id, pin: 0 }),
    ],
  };
  return projectWith(name, [newChip(name, draft)], randomSeed());
};
