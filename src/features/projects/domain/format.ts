import { z } from "zod";

import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { ImportError } from "./errors";
import { defaultChain, migrateToCurrent } from "./migrations";
import type { MigrationChain } from "./migrations";
import { ProjectSchema } from "./model";
import type { Project } from "./model";

export const CURRENT_FORMAT_VERSION = 1;
export const MAX_IMPORT_BYTES = 5_000_000;
const JSON_INDENT = 2;

export const ProjectFileSchema = z.object({
  format: z.literal("nand-project"),
  version: z.literal(CURRENT_FORMAT_VERSION),
  project: ProjectSchema,
});

// The version literal is checked before migration; after it, only the payload shape matters.
const PayloadSchema = ProjectFileSchema.omit({ version: true });
const EnvelopeSchema = z.looseObject({
  format: z.literal("nand-project"),
  version: z.number().int(),
});

/* oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- branded ids are mutable object types; the value is never mutated */
export const serializeProject = (project: Project): string =>
  JSON.stringify(
    { format: "nand-project", version: CURRENT_FORMAT_VERSION, project },
    undefined,
    JSON_INDENT,
  );

const parseJson = (text: string): Result<unknown, ImportError> => {
  try {
    return ok(JSON.parse(text) as unknown);
  } catch {
    return err({ type: "InvalidJson" });
  }
};

interface Envelope {
  readonly version: number;
}

/** Loose object: unknown keys are kept so migrations see the whole file. */
const parseEnvelope = (text: string): Result<Envelope, ImportError> => {
  const json = parseJson(text);
  if (!json.ok) {
    return json;
  }
  const envelope = EnvelopeSchema.safeParse(json.value);
  return envelope.success ? ok(envelope.data) : err({ type: "NotAProjectFile" });
};

const checkVersion = (version: number, current: number): Result<number, ImportError> => {
  if (version > current) {
    return err({ type: "FutureVersion", version, supported: current });
  }
  return version < 1 ? err({ type: "UnsupportedVersion", version }) : ok(version);
};

const validate = (data: unknown): Result<Project, ImportError> => {
  const parsed = PayloadSchema.safeParse(data);
  return parsed.success
    ? ok(parsed.data.project)
    : err({
        type: "InvalidProject",
        /* oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- zod issues are only read */
        issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      });
};
const migrateAndValidate = (
  envelope: Envelope,
  chain: MigrationChain,
  current: number,
): Result<Project, ImportError> => {
  const checked = checkVersion(envelope.version, current);
  if (!checked.ok) {
    return checked;
  }
  const migrated = migrateToCurrent(envelope, chain, current);
  return migrated.ok ? validate(migrated.value) : migrated;
};

export const parseProjectFile = (
  text: string,
  chain: MigrationChain = defaultChain,
  current: number = CURRENT_FORMAT_VERSION,
): Result<Project, ImportError> => {
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > MAX_IMPORT_BYTES) {
    return err({ type: "TooLarge", bytes });
  }
  const envelope = parseEnvelope(text);
  return envelope.ok ? migrateAndValidate(envelope.value, chain, current) : envelope;
};
