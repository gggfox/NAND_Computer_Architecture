/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import type { PlaceableKind } from "~/features/circuit-editor";
import { EMPTY_CIRCUIT, newChip, piece, projectWith } from "~/features/projects";
import type { Chip, Project } from "~/features/projects";

import { MATCH_LIMIT, quickAddView } from "./quick-add-view";
import type { QuickAddView } from "./quick-add-view";

const saved = (name: string, extra: Partial<Chip> = {}): Chip => ({
  ...newChip(name, EMPTY_CIRCUIT, { saved: true }),
  ...extra,
});

const custom = (chip: Chip): PlaceableKind => ({ type: "custom", chipId: chip.id });

const labels = (view: QuickAddView, id: string): readonly string[] =>
  view.sections.find((section) => section.id === id)?.entries.map((entry) => entry.label) ?? [];

const setup = () => {
  const main = saved("Main");
  const half = saved("Half adder", { starred: true });
  const draft = newChip("Scratch", EMPTY_CIRCUIT);
  const red = saved("Thing", { color: "#ef4444" });
  // "Outer" places Main, so Main can't hold it.
  const outer: Chip = {
    ...saved("Outer", { starred: true }),
    draft: { ...EMPTY_CIRCUIT, instances: [piece(custom(main), { x: 0, y: 0 })] },
  };
  const outerSaved: Chip = { ...outer, saved: outer.draft };
  const project: Project = projectWith("p", [main, half, draft, red, outerSaved]);
  return { project, main, half, draft, red, outer: outerSaved };
};

const browse = () => {
  const { project, main, half } = setup();
  const recent = [custom(half), { type: "split", width: 4 } as const];
  return { half, view: quickAddView({ project, openChipId: main.id, recent }, "") };
};

describe("quickAddView without a query", () => {
  it("without a query lists Recent, Starred, Pins, Built-in, then Tidy wires", () => {
    const { view } = browse();
    expect(view.sections.map((section) => section.id)).toEqual([
      "recent",
      "starred",
      "pins",
      "builtin",
      "tidy",
    ]);
    expect(labels(view, "recent")).toEqual(["Half adder", "Split 4"]);
    expect(labels(view, "starred")).toEqual(["Half adder"]);
    expect(labels(view, "pins")).toEqual(["Add input", "Add output"]);
    expect(labels(view, "builtin")).toHaveLength(7);
    expect(labels(view, "tidy")).toEqual(["Tidy wires", "Suggest wires"]);
  });

  it("says what each entry does", () => {
    const { half, view } = browse();
    const picks = (id: string) =>
      view.sections
        .find((section) => section.id === id)
        ?.entries.map((entry) => view.picks.get(entry.id));
    expect(picks("recent")?.[0]).toEqual({ type: "place", kind: custom(half) });
    expect(picks("pins")).toEqual([
      { type: "pin", direction: "input" },
      { type: "pin", direction: "output" },
    ]);
    expect(picks("tidy")).toEqual([{ type: "tidy" }, { type: "suggest" }]);
  });

  it("leaves out recent and starred chips that can't be placed, and empty sections", () => {
    const { project, main, draft, outer } = setup();
    const gone = saved("Gone");
    const view = quickAddView(
      { project, openChipId: main.id, recent: [custom(gone), custom(draft), custom(outer)] },
      "",
    );
    expect(view.sections.map((section) => section.id)).toEqual([
      "starred",
      "pins",
      "builtin",
      "tidy",
    ]);
    // Outer is starred too, but would contain the open chip.
    expect(labels(view, "starred")).toEqual(["Half adder"]);
  });
});

describe("quickAddView with a query", () => {
  it("with a query lists the placeable matches, ranked, as one list", () => {
    const { project, main } = setup();
    const view = quickAddView({ project, openChipId: main.id, recent: [] }, "er");
    expect(view.sections).toHaveLength(1);
    // Main is the open chip, Outer would contain it and Scratch is a draft: all left out.
    expect(labels(view, "matches")).toEqual(["Half adder", "Merge 4", "Merge 8", "Merge 16"]);
    expect(quickAddView({ project, openChipId: main.id, recent: [] }, "red").sections).toEqual([
      expect.objectContaining({ entries: [expect.objectContaining({ label: "Thing" })] }),
    ]);
  });

  it(`stops at ${String(MATCH_LIMIT)} matches`, () => {
    const many = Array.from({ length: MATCH_LIMIT + 5 }, (_unused, index) =>
      saved(`Chip ${String(index)}`),
    );
    const open = saved("Open");
    const project = projectWith("p", [open, ...many]);
    const view = quickAddView({ project, openChipId: open.id, recent: [] }, "chip");
    expect(view.sections[0]?.entries).toHaveLength(MATCH_LIMIT);
  });
});
