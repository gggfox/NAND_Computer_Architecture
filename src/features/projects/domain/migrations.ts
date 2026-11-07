import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { ImportError } from "./errors";

export interface Migration {
  readonly from: number;
  readonly migrate: (data: unknown) => unknown;
}
export type MigrationChain = readonly Migration[];

export const defaultChain: MigrationChain = [];

const outputVersion = (value: unknown): unknown =>
  typeof value === "object" && value !== null && "version" in value ? value.version : undefined;

/** A migration that throws, or that does not produce `from + 1`, becomes a typed error. */
const runStep = (step: Migration, value: unknown): Result<unknown, ImportError> => {
  try {
    const output = step.migrate(value);
    return outputVersion(output) === step.from + 1
      ? ok(output)
      : err({
          type: "InvalidProject",
          issues: [`migration did not produce version ${step.from + 1}`],
        });
  } catch {
    return err({ type: "InvalidProject", issues: [`migration from version ${step.from} failed`] });
  }
};

const advance = (
  value: unknown,
  version: number,
  chain: MigrationChain,
): Result<unknown, ImportError> => {
  const step = chain.find((migration) => migration.from === version);
  return step === undefined ? err({ type: "UnsupportedVersion", version }) : runStep(step, value);
};

/** Apply migrations from `data.version` up to `current`; a missing step is `UnsupportedVersion`. */
export const migrateToCurrent = (
  data: { readonly version: number },
  chain: MigrationChain,
  current: number,
): Result<unknown, ImportError> => {
  const { version: start } = data;
  let value: unknown = data;
  for (let version = start; version < current; version += 1) {
    const next = advance(value, version, chain);
    if (!next.ok) {
      return next.error.type === "UnsupportedVersion"
        ? err({ type: "UnsupportedVersion", version: start })
        : next;
    }
    ({ value } = next);
  }
  return ok(value);
};
