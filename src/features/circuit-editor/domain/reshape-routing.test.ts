/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import { newChip, piece, pinDef, pinPiece, projectWith, replaceChip } from "~/features/projects";
import type { Chip, PinRef, Project, Wire } from "~/features/projects";
import type { ChipId, WireId } from "~/shared/ids";
import { newWireId } from "~/shared/ids";

import { createRerouteAfterSave } from "./route-edits";
import { expectClean, link, NAND_A, NAND_OUT, nandAt } from "./routing/routing.fixtures";
import { applied, draftIn, wireIn } from "./wire-edits.fixtures";

/** The draft of `chipId` as a scene of `project`. */
const sceneIn = (project: Project, chipId: ChipId) => ({
  project,
  circuit: draftIn(project, chipId),
});

/** `project` with a routed wire from `from` to `to` in `chipId`'s draft, and its id. */
const connected = (
  project: Project,
  chipId: ChipId,
  ends: { readonly from: PinRef; readonly to: PinRef },
) => {
  const wireId = newWireId();
  return { project: applied(project, { type: "connectWire", chipId, wireId, ...ends }), wireId };
};

/** Two far NANDs and a wire between them, which no edit here touches. */
const bystanders = () => {
  const [left, right] = [nandAt(0, 800), nandAt(480, 800)];
  return { chips: [left, right], wire: link([left, NAND_OUT], [right, NAND_A]) };
};

/** A 4-bit input piece whose bit 2 drives a NAND, routed, beside the bystanders. */
const busHost = () => {
  const bus = pinDef("D", "input", 4);
  const busPiece = pinPiece(bus, { x: 0, y: 0 });
  const sink = nandAt(400, 200);
  const far = bystanders();
  const host = newChip("host", {
    pins: [bus],
    instances: [busPiece, sink, ...far.chips],
    wires: [far.wire],
  });
  const { project, wireId } = connected(projectWith("p", [host]), host.id, {
    from: { instanceId: busPiece.id, pin: 0, bit: 2 },
    to: { instanceId: sink.id, pin: NAND_A },
  });
  return { project, host, bus, far, wireId };
};

describe("setPinWidth routing", () => {
  it("re-routes a wire whose bus piece grew, so it stays clean", () => {
    const { project, host, bus, far, wireId } = busHost();
    const before = wireIn(project, host.id, wireId);
    const grown = applied(project, {
      type: "setPinWidth",
      chipId: host.id,
      pinId: bus.id,
      width: 16,
    });
    expect(wireIn(grown, host.id, wireId)).not.toBe(before);
    expectClean(sceneIn(grown, host.id), wireId);
    expect(wireIn(grown, host.id, far.wire.id)).toBe(far.wire);
  });
});

/** A saved child with one input and one output whose draft has six more inputs. */
const growingChild = (): { readonly child: Chip; readonly grown: Chip } => {
  const [input, output] = [pinDef("i", "input"), pinDef("o", "output")];
  const more = Array.from({ length: 6 }, (_unused, index) => pinDef(`x${String(index)}`, "input"));
  const child = newChip("c", { pins: [input, output], instances: [], wires: [] }, { saved: true });
  return { child, grown: { ...child, draft: { ...child.draft, pins: [...more, input, output] } } };
};

/** A parent placing the child, wired child output → NAND and NAND → child input, routed. */
const parentOf = (child: Chip) => {
  const instance = piece({ type: "custom", chipId: child.id }, { x: 0, y: 0 });
  // The sink is behind the child, so the output wire loops back past its right edge.
  const [driver, sink] = [nandAt(-400, 160), nandAt(-400, 320)];
  const far = bystanders();
  const parent = newChip("parent", {
    pins: [],
    instances: [instance, driver, sink, ...far.chips],
    wires: [far.wire],
  });
  const [inputDef, outputDef] = child.saved?.pins ?? [];
  assert(inputDef !== undefined && outputDef !== undefined);
  const first = connected(projectWith("p", [parent, child]), parent.id, {
    from: { instanceId: instance.id, pin: outputDef.id },
    to: { instanceId: sink.id, pin: NAND_A },
  });
  const second = connected(first.project, parent.id, {
    from: { instanceId: driver.id, pin: NAND_OUT },
    to: { instanceId: instance.id, pin: inputDef.id },
  });
  return {
    project: second.project,
    parent,
    far: far.wire,
    wireIds: [first.wireId, second.wireId] as const,
  };
};

/** `project` with `wireId` in `chipId`'s draft turned into a hand-bent wire on its own route. */
const handBent = (project: Project, chipId: ChipId, wireId: WireId): Project => {
  const chip = project.chips.find((item) => item.id === chipId);
  const draft = draftIn(project, chipId);
  const wires = draft.wires.map((item): Wire =>
    item.id === wireId ? { ...item, manualWaypoints: true } : item,
  );
  return chip === undefined
    ? project
    : replaceChip(project, { ...chip, draft: { ...draft, wires } });
};

/** One save pass over a history: saves `chipId` in each snapshot it is given. */
const savePass = (chipId: ChipId) => {
  const reroute = createRerouteAfterSave(chipId);
  return (snapshot: Project) => reroute(snapshot, applied(snapshot, { type: "saveChip", chipId }));
};

describe("saveChip routing of attached wires", () => {
  it("re-routes the wires on a grown chip, hand bends with one end moved included", () => {
    const { child, grown } = growingChild();
    const placed = parentOf(child);
    const [out, into] = placed.wireIds;
    const project = replaceChip(handBent(placed.project, placed.parent.id, into), grown);
    const saved = createRerouteAfterSave(child.id)(
      project,
      applied(project, { type: "saveChip", chipId: child.id }),
    );
    const scene = sceneIn(saved, placed.parent.id);
    expectClean(scene, out);
    expectClean(scene, into);
    expect(wireIn(saved, placed.parent.id, into).manualWaypoints).toBe(false);
    expect(wireIn(saved, placed.parent.id, placed.far.id)).toBe(placed.far);
  });

  it("routes each snapshot sharing a draft for the names it has", () => {
    const { child, grown } = growingChild();
    const { project, parent, wireIds } = parentOf(child);
    const short = replaceChip(project, grown);
    // A rename elsewhere in history: the same parent draft, a wider child.
    const long = replaceChip(short, { ...grown, name: "a much longer child name" });
    const save = savePass(child.id);
    const [first, second] = [save(short), save(long)];
    expect(draftIn(first, parent.id)).not.toBe(draftIn(second, parent.id));
    for (const [snapshot, wireId] of [first, second].flatMap((item) =>
      wireIds.map((id) => [item, id] as const),
    )) {
      expectClean(sceneIn(snapshot, parent.id), wireId);
    }
    expect(draftIn(save({ ...short, name: "other" }), parent.id)).toBe(draftIn(first, parent.id));
  });
});

describe("renameChip routing", () => {
  it("re-routes the wires on a widened chip in every draft that places it", () => {
    const { child } = growingChild();
    const placed = parentOf(child);
    const other = parentOf(child);
    const project = {
      ...placed.project,
      chips: [...placed.project.chips, ...other.project.chips.slice(0, 1)],
    };
    const renamed = applied(project, {
      type: "renameChip",
      chipId: child.id,
      name: "a chip with a very long name",
    });
    for (const { parent, wireIds, far } of [placed, other]) {
      const scene = sceneIn(renamed, parent.id);
      for (const wireId of wireIds) {
        expectClean(scene, wireId);
      }
      expect(wireIn(renamed, parent.id, far.id)).toBe(far);
    }
  });

  it("the same name changes nothing", () => {
    const { child } = growingChild();
    const { project } = parentOf(child);
    expect(applied(project, { type: "renameChip", chipId: child.id, name: " c " })).toBe(project);
  });
});
