/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "vitest";

import { newChip, pinDef, pinPiece, piece, projectWith } from "./builders";
import { parseProjectFile, serializeProject } from "./format";

/*
 * Generates `e2e/fixtures/bus.json` from the real builders and checks that the committed file is
 * still what they produce and that it parses through the import path. Regenerate it with
 * `UPDATE_E2E_FIXTURES=1 pnpm vitest run src/features/projects/domain/bus-fixture.test.ts`.
 */

const FIXTURE = path.join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "..",
  "e2e",
  "fixtures",
  "bus.json",
);
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gu;
const ID_BASE = 0x2_00;
const HEX = 16;
const ID_DIGITS = 12;
const BUS_WIDTH = 4;
const SEED = 7;

/** A 4-bit input D (its pin at world (40, 80)), a NAND at (160, 40) and an output; no wires. */
const busProject = () => {
  const bus = pinDef("D", "input", BUS_WIDTH);
  const out = pinDef("OUT", "output");
  const draft = {
    pins: [bus, out],
    instances: [
      pinPiece(bus, { x: 0, y: 40 }),
      piece({ type: "nand" }, { x: 160, y: 40 }),
      pinPiece(out, { x: 320, y: 40 }),
    ],
    wires: [],
  };
  return projectWith("Bus", [newChip("Main", draft)], SEED);
};

/** Random ids replaced, in order of appearance, by fixed ones, so the file is reproducible. */
const withFixedIds = (text: string): string => {
  const ids = new Map<string, string>();
  return text.replaceAll(UUID, (id) => {
    const known = ids.get(id);
    if (known !== undefined) {
      return known;
    }
    const fixed = `00000000-0000-4000-8000-${(ID_BASE + ids.size).toString(HEX).padStart(ID_DIGITS, "0")}`;
    ids.set(id, fixed);
    return fixed;
  });
};

test("the bus E2E fixture is what the builders produce, and it imports", () => {
  const generated = `${withFixedIds(serializeProject(busProject()))}\n`;
  if (process.env["UPDATE_E2E_FIXTURES"] === "1") {
    writeFileSync(FIXTURE, generated);
  }
  const committed = readFileSync(FIXTURE, "utf-8");
  expect(committed).toBe(generated);
  expect(parseProjectFile(committed).ok).toBe(true);
});
