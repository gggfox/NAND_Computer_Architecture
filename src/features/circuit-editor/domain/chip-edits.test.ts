import { describe, expect, it } from "vitest";

import { EMPTY_CIRCUIT, newChip, planSave, projectWith } from "~/features/projects";
import { newChipId } from "~/shared/ids";

import { createChip, discardDraft, recolorChip, renameChip, saveChip } from "./chip-edits";
import { placeChip } from "./circuit-edits";
import { customPiece, twoChips } from "./circuit-edits.fixtures";

describe("createChip", () => {
  it("adds a draft-only empty chip", () => {
    const { project } = twoChips();
    const chipId = newChipId();
    const result = createChip(project, {
      type: "createChip",
      chipId,
      name: " Mux ",
      color: "#aabbcc",
    });
    const created = result.ok ? result.value.chips.find((chip) => chip.id === chipId) : undefined;
    expect(created).toEqual({
      id: chipId,
      name: "Mux",
      color: "#aabbcc",
      draft: EMPTY_CIRCUIT,
      tags: [],
    });
    expect(created?.saved).toBeUndefined();
  });

  it("rejects a duplicate id, an empty name and 'red'", () => {
    const { project, host } = twoChips();
    const chipId = newChipId();
    expect(
      createChip(project, { type: "createChip", chipId: host.id, name: "X", color: "#000000" }),
    ).toEqual({ ok: false, error: { type: "DuplicateChip", chipId: host.id } });
    expect(
      createChip(project, { type: "createChip", chipId, name: " ", color: "#000000" }),
    ).toEqual({ ok: false, error: { type: "EmptyName" } });
    expect(createChip(project, { type: "createChip", chipId, name: "X", color: "red" })).toEqual({
      ok: false,
      error: { type: "InvalidColor", color: "red" },
    });
  });
});

describe("renameChip and recolorChip", () => {
  it("change one field", () => {
    const { project, host } = twoChips();
    const renamed = renameChip(project, { type: "renameChip", chipId: host.id, name: " New " });
    expect(renamed.ok ? renamed.value.chips[0] : undefined).toEqual({ ...host, name: "New" });
    const recolored = recolorChip(project, {
      type: "recolorChip",
      chipId: host.id,
      color: "#123456",
    });
    expect(recolored.ok ? recolored.value.chips[0] : undefined).toEqual({
      ...host,
      color: "#123456",
    });
    expect(recolorChip(project, { type: "recolorChip", chipId: host.id, color: "#12345" })).toEqual(
      { ok: false, error: { type: "InvalidColor", color: "#12345" } },
    );
    expect(renameChip(project, { type: "renameChip", chipId: host.id, name: "" })).toEqual({
      ok: false,
      error: { type: "EmptyName" },
    });
  });

  it("report an unknown chip", () => {
    const { project } = twoChips();
    const chipId = newChipId();
    const missing = { ok: false, error: { type: "ChipNotFound", chipId } };
    expect(renameChip(project, { type: "renameChip", chipId, name: "x" })).toEqual(missing);
    expect(recolorChip(project, { type: "recolorChip", chipId, color: "#000000" })).toEqual(
      missing,
    );
    expect(discardDraft(project, { type: "discardDraft", chipId })).toEqual(missing);
  });
});

describe("saveChip", () => {
  it("equals planSave's project", () => {
    const { project, host } = twoChips();
    const plan = planSave(project, host.id);
    const result = saveChip(project, { type: "saveChip", chipId: host.id });
    expect(plan.ok).toBe(true);
    expect(result).toEqual({ ok: true, value: plan.ok ? plan.value.project : undefined });
  });

  it("passes WouldContainItself through", () => {
    const { project, host, notChip } = twoChips();
    const looped = {
      ...notChip,
      draft: { ...notChip.draft, instances: [customPiece(notChip.id)] },
    };
    const withLoop = { ...project, chips: [host, looped] };
    expect(saveChip(withLoop, { type: "saveChip", chipId: notChip.id })).toEqual({
      ok: false,
      error: { type: "WouldContainItself", chipId: notChip.id },
    });
  });
});

describe("discardDraft", () => {
  it("restores the saved circuit as the draft", () => {
    const { project, notChip, circuit } = twoChips();
    const edited = placeChip(project, {
      type: "placeChip",
      chipId: notChip.id,
      instance: customPiece(newChipId()),
    });
    const dirty = edited.ok ? edited.value : project;
    const result = discardDraft(dirty, { type: "discardDraft", chipId: notChip.id });
    expect(result.ok ? result.value.chips[1]?.draft : undefined).toEqual(circuit);
  });

  it("on a draft-only chip is ChipNotSaved", () => {
    const draftOnly = newChip("D");
    const project = projectWith("p", [draftOnly]);
    expect(discardDraft(project, { type: "discardDraft", chipId: draftOnly.id })).toEqual({
      ok: false,
      error: { type: "ChipNotSaved", chipId: draftOnly.id },
    });
  });
});
