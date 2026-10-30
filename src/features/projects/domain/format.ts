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
const VersionedSchema = z.looseObject({ version: z.number() });
const EnvelopeSchema = z.looseObject({
  format: z.literal("nand-project"),
  version: z.number().int(),
});

/* oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- branded ids are mutable object types; the value is never mutated */
const toFile = (project: Project) =>
  ({ format: "nand-project", version: CURRENT_FORMAT_VERSION, project }) as const;

/** The exported file: pretty-printed for people. */
/* oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- branded ids are mutable object types; the value is never mutated */
export const serializeProject = (project: Project): string =>
  JSON.stringify(toFile(project), undefined, JSON_INDENT);

/** The same file format, compact, for this browser's own storage. */
/* oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- branded ids are mutable object types; the value is never mutated */
export const serializeStoredProject = (project: Project): string => JSON.stringify(toFile(project));

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
  if (!migrated.ok) {
    return migrated;
  }
  // Wrong version after migration is an invalid result of a supported file, not an unsupported file.
  const reached = VersionedSchema.safeParse(migrated.value);
  return reached.success && reached.data.version === current
    ? validate(migrated.value)
    : err({
        type: "InvalidProject",
        issues: [`migration did not produce version ${current}`],
      });
};

/**
 * Parses a record this app wrote to its own storage. It is validated and migrated like an import,
 * but not size-capped: the cap guards against hostile files, and a project the user built must
 * always reopen, however large it grew.
 */
export const parseStoredProject = (
  text: string,
  chain: MigrationChain = defaultChain,
  current: number = CURRENT_FORMAT_VERSION,
): Result<Project, ImportError> => {
  const envelope = parseEnvelope(text);
  return envelope.ok ? migrateAndValidate(envelope.value, chain, current) : envelope;
};

/** Parses an untrusted file: rejected over `MAX_IMPORT_BYTES` before any JSON parsing. */
export const parseProjectFile = (
  text: string,
  chain: MigrationChain = defaultChain,
  current: number = CURRENT_FORMAT_VERSION,
): Result<Project, ImportError> => {
  const bytes = new TextEncoder().encode(text).byteLength;
  return bytes > MAX_IMPORT_BYTES
    ? err({ type: "TooLarge", bytes })
    : parseStoredProject(text, chain, current);
};
