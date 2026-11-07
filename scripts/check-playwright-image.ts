/*
 * Fails when a Playwright Docker image tag differs from the `@playwright/test` version in
 * pnpm-workspace.yaml. YAML and package.json cannot derive the tag, so this check keeps them equal.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const VERSION_LINE = /^\s*"?@playwright\/test"?:\s*(?<version>\S+)\s*$/mu;
const IMAGE_TAG = /mcr\.microsoft\.com\/playwright:v(?<version>[^\s-]+)-/gu;
const IMAGE_FILES: readonly string[] = ["package.json", ".github/workflows/ci.yml"];

function read(file: string): string {
  return readFileSync(path.join(ROOT, file), "utf-8");
}

function tagsOf(file: string): readonly (string | undefined)[] {
  const tags: (string | undefined)[] = [];
  for (const match of read(file).matchAll(IMAGE_TAG)) {
    tags.push(match.groups?.["version"]);
  }
  return tags;
}

function problemsOf(file: string, expected: string): readonly string[] {
  const tags = tagsOf(file);
  if (tags.length === 0) {
    return [`${file}: no Playwright image tag found.`];
  }
  return tags
    .filter((tag) => tag !== expected)
    .map((tag) => `${file}: image tag v${String(tag)} differs from @playwright/test ${expected}.`);
}

function main(): number {
  const expected = VERSION_LINE.exec(read("pnpm-workspace.yaml"))?.groups?.["version"];
  if (expected === undefined) {
    console.error("check-playwright-image: no @playwright/test version in pnpm-workspace.yaml.");
    return 1;
  }
  const problems = IMAGE_FILES.flatMap((file) => problemsOf(file, expected));
  for (const problem of problems) {
    console.error(`check-playwright-image: ${problem}`);
  }
  return problems.length === 0 ? 0 : 1;
}

process.exitCode = main();
