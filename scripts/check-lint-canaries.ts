/*
 * Proves each lint enforcement still fires. Every canary under tooling/lint-canaries starts with
 * `// expect: <rule-id>` (must be reported with that rule) or `// expect-not: <rule-id>`
 * (an allowed pattern that must NOT be reported with that rule, e.g. shared/ui -> shared).
 * Every other source file there must be listed in SUPPORT_FILES, so a canary that loses its header
 * fails the check instead of silently dropping out of it.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

interface Canary {
  readonly file: string;
  readonly rule: string;
  readonly mustReport: boolean;
}

interface Diagnostic {
  readonly code?: string;
}

const ROOT = path.resolve(import.meta.dirname, "..");
const CANARY_DIR = path.join(ROOT, "tooling", "lint-canaries");
const OXLINT = path.join(ROOT, "node_modules", ".bin", "oxlint");
const STYLELINT = path.join(ROOT, "node_modules", ".bin", "stylelint");
const EXPECT_HEADER = /^(?:\/\/|\/\*) (?<mode>expect|expect-not): (?<rule>\S+)/u;
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|css)$/u;
// Imported by canaries but not canaries themselves (paths relative to tooling/lint-canaries, `/`-separated).
const SUPPORT_FILES: ReadonlySet<string> = new Set([
  "src/features/b/domain/x.ts",
  "src/features/b/index.ts",
  "src/i18n/messages.ts",
  "src/shared/ui/button.ts",
  "src/shared/util.ts",
]);
const DIAGNOSTIC_CODE = /^(?<plugin>[\w-]+)\((?<rule>[\w-]+)\)$/u;
// Plugins whose rules are referenced without a prefix in `// expect:` headers.
const UNPREFIXED_PLUGINS = new Set(["eslint", "local"]);

interface ScannedFile {
  readonly relative: string;
  readonly canary: Canary | undefined;
}

interface CanaryScan {
  readonly canaries: readonly Canary[];
  readonly problems: readonly string[];
}

// Source files under tooling/lint-canaries, relative and `/`-separated.
function listSourceFiles(): readonly string[] {
  return readdirSync(CANARY_DIR, { recursive: true, encoding: "utf-8" })
    .map((relative) => relative.replaceAll("\\", "/"))
    .filter((relative) => SOURCE_FILE.test(relative))
    .toSorted();
}

function readCanary(relative: string): Canary | undefined {
  const file = path.join(CANARY_DIR, relative);
  const firstLine = readFileSync(file, "utf-8").split("\n", 1)[0] ?? "";
  const groups = EXPECT_HEADER.exec(firstLine)?.groups;
  const rule = groups?.["rule"];
  return rule === undefined ? undefined : { file, mustReport: groups?.["mode"] === "expect", rule };
}

// A file is a canary (has a header) or a listed support file (has none); returns what is wrong otherwise.
function classificationProblem(relative: string, canary: Canary | undefined): string | undefined {
  const isSupport = SUPPORT_FILES.has(relative);
  if (canary !== undefined && isSupport) {
    return `${relative} is listed in SUPPORT_FILES but has an expect header`;
  }
  if (canary === undefined && !isSupport) {
    return `${relative} has no \`// expect:\` / \`// expect-not:\` header`;
  }
  return undefined;
}

// Every source file must be a canary or a listed support file, and every listed support file must exist.
function findCanaries(): CanaryScan {
  const relatives = listSourceFiles();
  const scanned = relatives.map((relative): ScannedFile => ({
    relative,
    canary: readCanary(relative),
  }));
  const missingSupport = [...SUPPORT_FILES]
    .filter((support) => !relatives.includes(support))
    .map((support) => `SUPPORT_FILES lists ${support}, which does not exist`);
  return {
    canaries: scanned.flatMap(({ relative, canary }) =>
      canary === undefined || SUPPORT_FILES.has(relative) ? [] : [canary],
    ),
    problems: [
      ...scanned.flatMap(({ relative, canary }) => {
        const problem = classificationProblem(relative, canary);
        return problem === undefined ? [] : [problem];
      }),
      ...missingSupport,
    ],
  };
}

// Oxlint reports codes as `plugin(rule)`; turn them into config-style ids (`plugin/rule`).
function toRuleId(code: string): string {
  const match = DIAGNOSTIC_CODE.exec(code);
  const plugin = match?.groups?.["plugin"];
  const rule = match?.groups?.["rule"];
  if (plugin === undefined || rule === undefined) {
    return code;
  }
  return UNPREFIXED_PLUGINS.has(plugin) ? rule : `${plugin}/${rule}`;
}

function isDiagnostic(value: unknown): value is Diagnostic {
  return (
    typeof value === "object" &&
    value !== null &&
    (!("code" in value) || typeof value.code === "string")
  );
}

function isDiagnosticList(value: unknown): value is readonly Diagnostic[] {
  return Array.isArray(value) && value.every((item) => isDiagnostic(item));
}

const StylelintWarningSchema = z.object({ rule: z.string() });
const StylelintResultSchema = z.object({
  ignored: z.boolean().optional(),
  warnings: z.array(StylelintWarningSchema),
});
const StylelintOutputSchema = z.array(StylelintResultSchema);

// Stylelint's JSON formatter writes to stderr when there are problems, to stdout otherwise.
function parseStylelintOutput(stdout: string, stderr: string): ReadonlySet<string> | undefined {
  const raw = stderr.trim() || stdout.trim();
  const jsonStart = raw.indexOf("[");
  const json: unknown = jsonStart === -1 ? undefined : JSON.parse(raw.slice(jsonStart));
  const parsed = StylelintOutputSchema.safeParse(json);
  const first = parsed.success && parsed.data.length === 1 ? parsed.data[0] : undefined;
  return first === undefined || first.ignored === true
    ? undefined
    : new Set(first.warnings.map((warning) => warning.rule));
}

// Returns undefined when Stylelint did not lint the file (ignored, crashed or unparsable output).
function reportedStylelintRules(file: string): ReadonlySet<string> | undefined {
  const result = spawnSync(
    STYLELINT,
    ["--config", path.join(ROOT, ".stylelintrc.json"), "--formatter", "json", file],
    { cwd: ROOT, encoding: "utf-8" },
  );
  return parseStylelintOutput(result.stdout, result.stderr);
}

// Returns undefined when oxlint did not lint the file, so `expect-not` can never pass vacuously.
function reportedRules(file: string): ReadonlySet<string> | undefined {
  const result = spawnSync(
    OXLINT,
    ["--config", path.join(ROOT, ".oxlintrc.json"), "--type-aware", "--format", "json", file],
    { cwd: ROOT, encoding: "utf-8" },
  );
  const jsonStart = result.stdout.indexOf("{");
  if (jsonStart === -1) {
    console.error(result.stderr.trim());
    return undefined;
  }
  const parsed: unknown = JSON.parse(result.stdout.slice(jsonStart));
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("number_of_files" in parsed) ||
    parsed.number_of_files !== 1 ||
    !("diagnostics" in parsed) ||
    !isDiagnosticList(parsed.diagnostics)
  ) {
    return undefined;
  }
  const { diagnostics } = parsed;
  return new Set(
    diagnostics.flatMap((diagnostic) =>
      diagnostic.code === undefined ? [] : [toRuleId(diagnostic.code)],
    ),
  );
}

// Lints one canary, prints its verdict and returns whether it behaved as declared.
function checkCanary({ file, rule, mustReport }: Canary): boolean {
  const rules = file.endsWith(".css") ? reportedStylelintRules(file) : reportedRules(file);
  const passed = rules !== undefined && rules.has(rule) === mustReport;
  const verdict = mustReport ? "caught" : "allowed";
  const expectation = mustReport ? "expect" : "expect-not";
  console.log(
    `${passed ? verdict : "FAILED"}  ${path.relative(ROOT, file)}  (${expectation} ${rule})`,
  );
  if (!passed) {
    const reported = rules === undefined ? "<linter did not lint the file>" : [...rules].join(", ");
    console.log(`        reported: ${reported || "nothing"}`);
  }
  return passed;
}

function printProblems(problems: readonly string[]): void {
  if (problems.length === 0) {
    return;
  }
  console.error(
    `\n${problems.length} file(s) under tooling/lint-canaries are neither canary nor support file:`,
  );
  for (const problem of problems) {
    console.error(`  ${problem}`);
  }
}

function printFailures(failed: readonly Canary[]): void {
  if (failed.length === 0) {
    return;
  }
  console.error(`\n${failed.length} canary file(s) did not lint as expected:`);
  for (const { file, rule, mustReport } of failed) {
    const why = mustReport ? "should be reported with" : "must not be reported with";
    console.error(`  ${path.relative(ROOT, file)} ${why} ${rule}`);
  }
}

function main(): void {
  const { canaries, problems } = findCanaries();
  const failed = canaries.filter((canary) => !checkCanary(canary));
  if (canaries.length === 0) {
    console.error("No canaries found under tooling/lint-canaries.");
    process.exitCode = 1;
  } else if (problems.length > 0 || failed.length > 0) {
    printProblems(problems);
    printFailures(failed);
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${canaries.length} lint canaries behaved as expected.`);
  }
}

main();
