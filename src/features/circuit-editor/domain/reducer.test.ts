import { describe, expect, it } from "vitest";

import { createDemoProject } from "~/features/projects";
import type { ChipInstance, Project } from "~/features/projects";
import { newChipId, newInstanceId } from "~/shared/ids";

import { applyAction, editorErrorMessage } from "./reducer";

const nandAt = (left: number): ChipInstance => ({
  id: newInstanceId(),
  kind: { type: "builtin", builtin: "nand" },
  /* oxlint-disable-next-line eslint/id-length -- `x` and `y` are coordinate names */
  position: { x: left, y: 0 },
});

const firstOfKind = (project: Project, builtin: string): ChipInstance => {
  const found = project.rootCircuit.instances.find(
    (item) => item.kind.type === "builtin" && item.kind.builtin === builtin,
  );
  if (found === undefined) {
    return nandAt(0);
  }
  return found;
};

describe("applyAction", () => {
  it("placeChip adds an instance without mutating the input", () => {
    const project = createDemoProject("x");
    const instance = nandAt(5);
    const result = applyAction(project, { type: "placeChip", instance });
    expect(result.ok && result.value.rootCircuit.instances).toHaveLength(5);
    expect(project.rootCircuit.instances).toHaveLength(4);
  });

  it("rejects a duplicate instance id", () => {
    const project = createDemoProject("x");
    const [existing] = project.rootCircuit.instances;
    const result = applyAction(project, {
      type: "placeChip",
      instance: { ...nandAt(1), id: existing?.id ?? newInstanceId() },
    });
    expect(!result.ok && result.error.type).toBe("DuplicateInstance");
  });

  it("moveChip updates the position", () => {
    const project = createDemoProject("x");
    const target = firstOfKind(project, "nand");
    /* oxlint-disable-next-line eslint/id-length -- `x` and `y` are coordinate names */
    const position = { x: 9, y: 9 };
    const result = applyAction(project, { type: "moveChip", instanceId: target.id, position });
    const moved = result.ok
      ? result.value.rootCircuit.instances.find((item) => item.id === target.id)
      : undefined;
    expect(moved?.position).toEqual(position);
  });

  it("moveChip with an unknown id is InstanceNotFound", () => {
    const missing = newInstanceId();
    const result = applyAction(createDemoProject("x"), {
      type: "moveChip",
      instanceId: missing,
      /* oxlint-disable-next-line eslint/id-length -- `x` and `y` are coordinate names */
      position: { x: 0, y: 0 },
    });
    expect(result).toEqual({ ok: false, error: { type: "InstanceNotFound", instanceId: missing } });
  });
});

describe("applyAction removeChip", () => {
  it("removeChip drops the instance and its attached wires", () => {
    const project = createDemoProject("x");
    const nand = firstOfKind(project, "nand");
    const result = applyAction(project, { type: "removeChip", instanceId: nand.id });
    expect(result.ok && result.value.rootCircuit.instances).toHaveLength(3);
    expect(result.ok && result.value.rootCircuit.wires).toHaveLength(0);
  });

  it("removeChip with an unknown id is InstanceNotFound", () => {
    const result = applyAction(createDemoProject("x"), {
      type: "removeChip",
      instanceId: newInstanceId(),
    });
    expect(!result.ok && result.error.type).toBe("InstanceNotFound");
  });

  it("protects input and output instances", () => {
    const project = createDemoProject("x");
    for (const builtin of ["input", "output"]) {
      const target = firstOfKind(project, builtin);
      const result = applyAction(project, { type: "removeChip", instanceId: target.id });
      expect(result).toEqual({
        ok: false,
        error: { type: "ProtectedInstance", instanceId: target.id },
      });
    }
  });

  it("removes custom chips (not protected)", () => {
    const project = createDemoProject("x");
    const custom: ChipInstance = {
      ...nandAt(1),
      kind: { type: "custom", chipId: newChipId() },
    };
    const added = applyAction(project, { type: "placeChip", instance: custom });
    const next = added.ok ? added.value : project;
    const result = applyAction(next, { type: "removeChip", instanceId: custom.id });
    expect(result.ok).toBe(true);
  });
});

describe("editorErrorMessage", () => {
  it("returns a non-empty message for every error", () => {
    const instanceId = newInstanceId();
    for (const type of ["InstanceNotFound", "DuplicateInstance", "ProtectedInstance"] as const) {
      expect(editorErrorMessage({ type, instanceId }).length).toBeGreaterThan(0);
    }
  });

  it("rejects an unknown error with assertNever", () => {
    /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Deliberately violates the exhaustive union to hit assertNever */
    const unknown = JSON.parse('{"type":"Bogus"}') as never;
    expect(() => editorErrorMessage(unknown)).toThrow("Unexpected value");
  });
});

describe("applyAction exhaustiveness", () => {
  it("rejects an unknown action with assertNever", () => {
    /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Deliberately violates the exhaustive union to hit assertNever */
    const unknown = JSON.parse('{"type":"Bogus"}') as never;
    expect(() => applyAction(createDemoProject("x"), unknown)).toThrow("Unexpected value");
  });
});
