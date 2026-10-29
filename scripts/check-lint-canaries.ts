/*
 * Proves each lint enforcement still fires: every canary under tooling/lint-canaries
 * declares `// expect: <rule-id>` on its first line and must be reported with that rule.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

interface Canary {
  readonly file: string;
  readonly expected: string;
}

interface Diagnostic {
  readonly code?: string;
}

const ROOT = path.resolve(import.meta.dirname, "..");
const CANARY_DIR = path.join(ROOT, "tooling", "lint-canaries");
const OXLINT = path.join(ROOT, "node_modules", ".bin", "oxlint");
const EXPECT_HEADER = /^\/\/ expect: (?<rule>\S+)/u;
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
      const rule = EXPECT_HEADER.exec(firstLine)?.groups?.["rule"];
      return rule === undefined ? [] : [{ expected: rule, file }];
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

function reportedRules(file: string): ReadonlySet<string> {
  const result = spawnSync(
    OXLINT,
    ["--config", path.join(ROOT, ".oxlintrc.json"), "--type-aware", "--format", "json", file],
    { cwd: ROOT, encoding: "utf-8" },
  );
  const jsonStart = result.stdout.indexOf("{");
  if (jsonStart === -1) {
    return new Set([`<no oxlint output: ${result.stderr.trim()}>`]);
  }
  const parsed: unknown = JSON.parse(result.stdout.slice(jsonStart));
  const diagnostics: unknown =
    typeof parsed === "object" && parsed !== null && "diagnostics" in parsed
      ? parsed.diagnostics
      : [];
  if (!isDiagnosticList(diagnostics)) {
    return new Set();
  }
  return new Set(
    diagnostics.flatMap((diagnostic) =>
      diagnostic.code === undefined ? [] : [toRuleId(diagnostic.code)],
    ),
  );
}

function main(): void {
  const canaries = findCanaries();
  const missed = canaries.filter(({ file, expected }) => {
    const rules = reportedRules(file);
    const caught = rules.has(expected);
    const relative = path.relative(ROOT, file);
    console.log(`${caught ? "caught" : "MISSED"}  ${relative}  (expect ${expected})`);
    if (!caught) {
      console.log(`        reported: ${[...rules].join(", ") || "nothing"}`);
    }
    return !caught;
  });
  if (canaries.length === 0) {
    console.error("No canaries found under tooling/lint-canaries.");
    process.exitCode = 1;
  } else if (missed.length > 0) {
    console.error(`\n${missed.length} canary file(s) passed lint but should have failed:`);
    for (const { file, expected } of missed) {
      console.error(`  ${path.relative(ROOT, file)} (expected ${expected})`);
    }
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${canaries.length} lint canaries were reported.`);
  }
}

main();
