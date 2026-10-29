import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { ImportError } from "./errors";

export interface Migration {
  readonly from: number;
  readonly migrate: (data: unknown) => unknown;
}
export type MigrationChain = readonly Migration[];

export const defaultChain: MigrationChain = [];

/** Apply migrations from `data.version` up to `current`; a missing step is `UnsupportedVersion`. */
export const migrateToCurrent = (
  data: { readonly version: number },
  chain: MigrationChain,
  current: number,
): Result<unknown, ImportError> => {
  const { version: start } = data;
  let value: unknown = data;
  for (let version = start; version < current; version += 1) {
    const step = chain.find((migration) => migration.from === version);
    if (step === undefined) {
      return err({ type: "UnsupportedVersion", version: start });
    }
    value = step.migrate(value);
  }
  return ok(value);
};
