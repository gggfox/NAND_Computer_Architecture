import { planSave } from "~/features/projects";
import type { BitWidth, Project, SaveEffect } from "~/features/projects";
import type { ChipId } from "~/shared/ids";
import { ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { EditorError } from "./actions";

export type SaveConsequence =
  | { readonly type: "wiresRemoved"; readonly chipName: string; readonly count: number }
  | { readonly type: "pinRemoved"; readonly name: string }
  | {
      readonly type: "pinWidthChanged";
      readonly name: string;
      readonly from: BitWidth;
      readonly to: BitWidth;
    };

export interface SavePreview {
  /** Empty when the save breaks nothing: it then happens with no dialog (D4). */
  readonly consequences: readonly SaveConsequence[];
}

const causes = (effects: readonly SaveEffect[]): readonly SaveConsequence[] => {
  const removed = effects.flatMap((effect): readonly SaveConsequence[] =>
    effect.type === "PinRemoved" ? [{ type: "pinRemoved", name: effect.name }] : [],
  );
  const resized = effects.flatMap((effect): readonly SaveConsequence[] =>
    effect.type === "PinWidthChanged"
      ? [{ type: "pinWidthChanged", name: effect.name, from: effect.from, to: effect.to }]
      : [],
  );
  return [...removed, ...resized];
};

/** One line per parent that loses wires, in project chip order. */
const losses = (project: Project, effects: readonly SaveEffect[]): readonly SaveConsequence[] => {
  const counts = new Map(
    effects.flatMap((effect) =>
      effect.type === "WiresRemoved" ? [[effect.chipId, effect.count]] : [],
    ),
  );
  return project.chips.flatMap((chip): readonly SaveConsequence[] => {
    const count = counts.get(chip.id);
    return count === undefined ? [] : [{ type: "wiresRemoved", chipName: chip.name, count }];
  });
};

/**
 * Dry-runs a save and lists what it breaks. A save that drops no wire breaks nothing, however
 * its pins changed, so the list is then empty and the save needs no confirmation (D4).
 */
export const savePreview = (project: Project, chipId: ChipId): Result<SavePreview, EditorError> => {
  const plan = planSave(project, chipId);
  if (!plan.ok) {
    return plan;
  }
  const lost = losses(project, plan.value.effects);
  return ok({ consequences: lost.length === 0 ? [] : [...causes(plan.value.effects), ...lost] });
};
