/*
 * Proves each lint enforcement still fires. Every canary under tooling/lint-canaries starts with
 * `// expect: <rule-id>` (must be reported with that rule) or `// expect-not: <rule-id>`
 * (an allowed pattern that must NOT be reported with that rule, e.g. shared/ui -> shared).
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

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
const EXPECT_HEADER = /^\/\/ (?<mode>expect|expect-not): (?<rule>\S+)/u;
const SOURCE_FILE = /\.tsx?$/u;
const DIAGNOSTIC_CODE = /^(?<plugin>[\w-]+)\((?<rule>[\w-]+)\)$/u;
// Plugins whose rules are referenced without a prefix in `// expect:` headers.
const UNPREFIXED_PLUGINS = new Set(["eslint", "local"]);

function findCanaries(): readonly Canary[] {
  return readdirSync(CANARY_DIR, { recursive: true, encoding: "utf-8" })
    .filter((relative) => SOURCE_FILE.test(relative))
    .toSorted()
    .flatMap((relative) => {
      const file = path.join(CANARY_DIR, relative);
      const firstLine = readFileSync(file, "utf-8").split("\n", 1)[0] ?? "";
      const groups = EXPECT_HEADER.exec(firstLine)?.groups;
      const rule = groups?.["rule"];
      return rule === undefined ? [] : [{ file, mustReport: groups?.["mode"] === "expect", rule }];
    });
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
  const rules = reportedRules(file);
  const passed = rules !== undefined && rules.has(rule) === mustReport;
  const verdict = mustReport ? "caught" : "allowed";
  const expectation = mustReport ? "expect" : "expect-not";
  console.log(`${passed ? verdict : "FAILED"}  ${path.relative(ROOT, file)}  (${expectation} ${rule})`);
  if (!passed) {
    const reported = rules === undefined ? "<oxlint did not lint the file>" : [...rules].join(", ");
    console.log(`        reported: ${reported || "nothing"}`);
  }
  return passed;
}

function printFailures(failed: readonly Canary[]): void {
  console.error(`\n${failed.length} canary file(s) did not lint as expected:`);
  for (const { file, rule, mustReport } of failed) {
    const why = mustReport ? "should be reported with" : "must not be reported with";
    console.error(`  ${path.relative(ROOT, file)} ${why} ${rule}`);
  }
}

function main(): void {
  const canaries = findCanaries();
  const failed = canaries.filter((canary) => !checkCanary(canary));
  if (canaries.length === 0) {
    console.error("No canaries found under tooling/lint-canaries.");
    process.exitCode = 1;
  } else if (failed.length > 0) {
    printFailures(failed);
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${canaries.length} lint canaries behaved as expected.`);
  }
}

main();
