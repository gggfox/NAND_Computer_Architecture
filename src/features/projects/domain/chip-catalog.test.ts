/* oxlint-disable typescript/prefer-readonly-parameter-types -- projects and chips carry branded ids (mutable object types); none is mutated */
import { describe, expect, test } from "vitest";

import { newChipId, newFolderId } from "~/shared/ids";
import type { FolderId } from "~/shared/ids";
import type { Result } from "~/shared/result";

import { newChip, piece, projectWith } from "./builders";
import { deleteChip, fileChip, normalizeTags, setStarred, setTags } from "./chip-catalog";
import type { Chip, Circuit } from "./model";

const folder = { id: newFolderId(), name: "Arithmetic" };

const top: FolderId | undefined = [folder.id].find(() => false);

const value = <T, E>(result: Result<T, E>): T =>
  result.ok ? result.value : expect.fail("expected an ok result");

const failure = <T, E>(result: Result<T, E>): E =>
  result.ok ? expect.fail("expected an error") : result.error;

const uses = (child: Chip): Circuit => ({
  pins: [],
  instances: [piece({ type: "custom", chipId: child.id })],
  wires: [],
});

describe("normalizeTags", () => {
  test("trims, drops empties and de-duplicates ignoring case", () => {
    expect(normalizeTags([" gate ", "", "Gate", "adder"])).toEqual(["gate", "adder"]);
  });
});

describe("fileChip, setStarred and setTags", () => {
  const chip = newChip("A");
  const project = { ...projectWith("p", [chip, newChip("B")]), folders: [folder] };

  test("fileChip files into a folder and back to the top level", () => {
    const filed = value(fileChip(project, chip.id, folder.id));
    expect(filed.chips[0]?.folderId).toBe(folder.id);
    const unfiled = value(fileChip(filed, chip.id, top));
    expect(unfiled.chips[0]).not.toHaveProperty("folderId");
  });

  test("fileChip refuses unknown folders and chips", () => {
    const missing = newFolderId();
    expect(failure(fileChip(project, chip.id, missing))).toEqual({
      type: "FolderNotFound",
      folderId: missing,
    });
    const unknown = newChipId();
    expect(failure(fileChip(project, unknown, top))).toEqual({
      type: "ChipNotFound",
      chipId: unknown,
    });
  });

  test("setStarred and setTags update the chip", () => {
    expect(value(setStarred(project, chip.id, true)).chips[0]?.starred).toBe(true);
    expect(value(setTags(project, chip.id, [" a ", "A", "b"])).chips[0]?.tags).toEqual(["a", "b"]);
  });

  test("setStarred and setTags refuse unknown chips", () => {
    const unknown = newChipId();
    const error = { type: "ChipNotFound", chipId: unknown };
    const starFailure = failure(setStarred(project, unknown, true));
    const tagFailure = failure(setTags(project, unknown, []));
    expect(starFailure).toEqual(error);
    expect(tagFailure).toEqual(error);
  });
});

describe("deleteChip", () => {
  test("refuses a chip placed in a draft or a saved version", () => {
    const child = newChip("Half adder");
    const inDraft = newChip("Full adder", uses(child));
    const draftUse = projectWith("p", [child, inDraft]);
    const draftFailure = failure(deleteChip(draftUse, child.id));
    expect(draftFailure).toEqual({
      type: "ChipInUse",
      chipId: child.id,
      usedByName: "Full adder",
    });
    const inSaved = {
      ...newChip("Saver", uses(child), { saved: true }),
      draft: newChip("x").draft,
    };
    const savedUse = projectWith("p", [child, inSaved]);
    const savedFailure = failure(deleteChip(savedUse, child.id));
    expect(savedFailure).toMatchObject({ usedByName: "Saver" });
  });

  test("refuses the last chip and unknown chips", () => {
    const only = newChip("Only");
    const lone = failure(deleteChip(projectWith("p", [only]), only.id));
    expect(lone).toEqual({ type: "LastChip" });
    const unknown = newChipId();
    const pair = projectWith("p", [only, newChip("B")]);
    const missing = failure(deleteChip(pair, unknown));
    expect(missing).toEqual({
      type: "ChipNotFound",
      chipId: unknown,
    });
  });

  test("removes the chip and re-points lastOpenedChipId when it was open", () => {
    const first = newChip("A");
    const second = newChip("B");
    const project = projectWith("p", [first, second]);
    const afterOpen = value(deleteChip(project, first.id));
    expect(afterOpen.chips).toEqual([second]);
    expect(afterOpen.lastOpenedChipId).toBe(second.id);
    const afterOther = value(deleteChip(project, second.id));
    expect(afterOther.chips).toEqual([first]);
    expect(afterOther.lastOpenedChipId).toBe(first.id);
  });
});
