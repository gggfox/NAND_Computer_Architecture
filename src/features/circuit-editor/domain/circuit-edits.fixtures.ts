import { newChip, piece, pinDef, pinPiece, projectWith, wire } from "~/features/projects";
import type { Circuit, Project } from "~/features/projects";
import type { ChipId } from "~/shared/ids";

import type { PlaceableInstance } from "./actions";

/* oxlint-disable-next-line eslint/id-length -- `x` and `y` are coordinate names */
export const at = (left: number) => ({ x: left, y: 0 });

export const nandPiece = (left = 0): PlaceableInstance => piece({ type: "nand" }, at(left));

export const customPiece = (chipId: ChipId): PlaceableInstance => piece({ type: "custom", chipId });

export const draftOf = (project: Project, chipId: ChipId): Circuit | undefined =>
  project.chips.find((chip) => chip.id === chipId)?.draft;

const NAND_LEFT = 100;
const NAND_INDEX = 3;

const hostCircuit = (): Circuit => {
  const pins = [pinDef("A", "input"), pinDef("B", "input"), pinDef("OUT", "output")] as const;
  const [pieceA, pieceB, pieceOut] = pins.map((def) => pinPiece(def));
  const nand = nandPiece(NAND_LEFT);
  const ids = [pieceA?.id, pieceB?.id, pieceOut?.id] as const;
  const [idA, idB, idOut] = ids;
  return {
    pins,
    instances: [...[pieceA, pieceB, pieceOut].flatMap((item) => (item ? [item] : [])), nand],
    wires: [
      wire({ instanceId: idA ?? nand.id, pin: 0 }, { instanceId: nand.id, pin: 0 }),
      wire({ instanceId: idB ?? nand.id, pin: 0 }, { instanceId: nand.id, pin: 1 }),
      wire({ instanceId: nand.id, pin: 2 }, { instanceId: idOut ?? nand.id, pin: 0 }),
    ],
  };
};

/** A demo chip `H` (open: pins A, B, OUT, one NAND, three wires) and a saved chip `NOT`. */
export const twoChips = () => {
  const circuit = hostCircuit();
  const host = newChip("H", circuit);
  const notChip = newChip("NOT", circuit, { saved: true });
  const pieceA = circuit.instances.at(0);
  const nand = circuit.instances.at(NAND_INDEX);
  return {
    project: projectWith("p", [host, notChip]),
    host,
    notChip,
    circuit,
    pieceA: pieceA ?? nandPiece(),
    nand: nand ?? nandPiece(),
  };
};

/** `twoChips()` with the host's wires removed. */
export const unwired = () => {
  const base = twoChips();
  const host = { ...base.host, draft: { ...base.circuit, wires: [] } };
  return { ...base, host, project: projectWith("p", [host, base.notChip]) };
};
