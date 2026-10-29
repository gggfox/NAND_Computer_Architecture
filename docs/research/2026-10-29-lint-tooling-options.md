# Lint, format and static-analysis tooling options

Date: 2026-10-29. This follows on from `2026-10-29-strict-template-stack.md`, so read that first. Facts already established there are not repeated:
- the TS 7 / TS 6-alias setup
- the typescript-eslint presets
- `strict-boolean-expressions` and `switch-exhaustiveness-check` options
- the dependency-cruiser vs madge comparison
- the sonarjs licence

Sources are primary only: official docs, GitHub repos, issues and PRs, and npm registry metadata. Each version is the npm `latest` dist-tag as of today, read from `registry.npmjs.org/<pkg>`. **[uncertain]** marks something I could not confirm. **[analysis]** marks my own judgement.

## Corrections to the earlier doc

- **oxlint can run sonarjs `cognitive-complexity`.** It loads it as a JS plugin. Oxlint's conformance suite passes 99.6% of SonarJS tests, excluding typed rules ([JS plugins alpha post](https://github.com/oxc-project/website/blob/main/src/blog/2026-03-11-oxlint-js-plugins-alpha.md)). The earlier "no cognitive-complexity" verdict applied to *native* rules only.
- **The 2 typed rules tsgolint is missing are `naming-convention` and `prefer-destructuring`.** I checked this by diffing every rule with `requiresTypeChecking: true` in `@typescript-eslint/eslint-plugin@8.72.1` against the type-aware rules on [oxc's rules page](https://oxc.rs/docs/guide/usage/linter/rules.html). The rules page lists 61 type-aware rules; typescript-eslint has 63, and the extra 2 are those above.
- **`eslint-plugin-boundaries` works inside oxlint.** It loads through `jsPlugins` with no code changes, provided you set `import/resolver`. The maintainer wrote an "Oxlint integration" guide ([issue #431](https://github.com/javierbrea/eslint-plugin-boundaries/issues/431), PR #470).
- **`eslint-plugin-jsx-a11y` does not support ESLint 10.** Its latest is 6.10.2 (2024-10-26), with peer `eslint ^3…^9`. Issue [#1075](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/issues/1075) "Support for ESLint v10" is still open. Meanwhile ESLint 9 reached EOL on 2026-08-06 ([version support](https://eslint.org/version-support/)). This matters a lot for an accessibility-first project (see section 6).

## 1. Coverage matrix

Legend:
- ✅ means native and stable.
- 🟡 means partial, nursery/alpha, or needs a plugin or workaround.
- ❌ means not available.

| Required check | ESLint 10.13 + typescript-eslint 8.72 (TS 6 alias) | Biome 2.6.4 | oxlint 1.90 + tsgolint 7.0.2005 (TS 7) | oxlint + ESLint (eslint-plugin-oxlint) |
|---|---|---|---|---|
| no-floating-promises / no-misused-promises | ✅ | 🟡 nursery `noFloatingPromises`, `noMisusedPromises` (own inference, not tsc) | ✅ (type-aware) | ✅ (oxlint) |
| strict-boolean-expressions | ✅ | 🟡 nursery `useStrictBooleanExpressions` | ✅ but marked 🚧 (work in progress) on the rules page **[uncertain: which options are missing]** | ✅ (keep it on in ESLint until oxlint's 🚧 clears) |
| switch-exhaustiveness-check | ✅ | 🟡 nursery `useExhaustiveSwitchCases`. Open bugs: cross-module types, `Array.from` ([#6929](https://github.com/biomejs/biome/issues/6929), [#11748](https://github.com/biomejs/biome/issues/11748)) | ✅ | ✅ |
| no-unsafe-* (argument, assignment, call, member-access, return, type-assertion…) | ✅ | 🟡 only `noUnsafeReturn` and `noUnsafeUnaryMinus` (nursery) | ✅ all 9 typed no-unsafe-* | ✅ |
| only-throw-error (typed) | ✅ | 🟡 `useThrowOnlyError` (style), static only, "will be improved … once Biome supports type inference" ([rule](https://biomejs.dev/linter/rules/use-throw-only-error/)) | ✅ | ✅ |
| Rest of typed `strictTypeChecked` | ✅ 63/63 | ❌ about 20 typed rules exist, 4 stable ([domains](https://biomejs.dev/linter/domains/)) | ✅ 61/63. Missing `naming-convention` and `prefer-destructuring` | ✅ 63/63 |
| Cognitive complexity | ✅ sonarjs 4.2.2 | ✅ `noExcessiveCognitiveComplexity` (default 15, not recommended, so opt-in) | 🟡 sonarjs through `jsPlugins` (alpha) | ✅ |
| Cyclomatic complexity | ✅ core `complexity` | ❌ none found **[uncertain]**. Only `noExcessiveLinesPerFunction` | ✅ `complexity`, `max-depth`, `max-lines-per-function`, `max-statements`, `max-nested-callbacks` | ✅ |
| Import cycles | 🟡 `import-x/no-cycle` (slow) or dependency-cruiser | ✅ `noImportCycles` (project domain; "computationally expensive"; `ignoreTypes` defaults to true) ([rule](https://biomejs.dev/linter/rules/no-import-cycles/)) | ✅ `import/no-cycle` (multi-file, native) | ✅ (oxlint) |
| Feature boundaries (feature A must not import feature B's internals) | ✅ eslint-plugin-boundaries 7.4.0, or Sheriff | 🟡 `noPrivateImports` with JSDoc `@package`/`@private` tags ([rule](https://biomejs.dev/linter/rules/no-private-imports/)), plus `noRestrictedImports` patterns inside `overrides` | 🟡 boundaries through `jsPlugins` (documented), or `no-restricted-imports` patterns per `overrides` | ✅ |
| Engine must not import React or the DOM | ✅ `no-restricted-imports` + `no-restricted-globals` in a `files` block | ✅ `noRestrictedImports` in an `overrides` entry. 🟡 DOM globals have no `noRestrictedGlobals` per folder **[uncertain]** | ✅ `no-restricted-imports` + `no-restricted-globals` in `overrides` | ✅ |
| Ban `throw` in some folders | ✅ `no-restricted-syntax: ThrowStatement` | ✅ GritQL plugin with `includes` globs ([plugins](https://biomejs.dev/linter/plugins/)) | 🟡 **no `no-restricted-syntax`**. Needs a ~10-line local JS-plugin rule | ✅ (ESLint) |
| React hooks / React Compiler rules | ✅ eslint-plugin-react-hooks 7.1.1 `recommended`: 17 rules incl. Compiler diagnostics ([react.dev](https://react.dev/reference/eslint-plugin-react-hooks)) | 🟡 only `useHookAtTopLevel` + `useExhaustiveDependencies`. No Compiler rules | ✅ 22 native React Compiler rules since 1.79 ([post](https://github.com/oxc-project/website/blob/main/src/blog/2026-08-18-react-compiler-support.md)) | ✅ |
| JSX a11y | 🟡 jsx-a11y has no ESLint 10 peer. Fork `eslint-plugin-jsx-a11y-x` 0.2.0 has `^9 \|\| ^10` | ✅ 33 rules ported from jsx-a11y | ✅ 36 native jsx-a11y rules | ✅ (oxlint) |
| Format | Prettier / oxfmt (external) | ✅ built in | oxfmt (beta) | — |
| Runs on TS 7 alone | ❌ needs the `typescript` → TS 6 alias. TS 7.1 backend is in PR [#12803](https://github.com/typescript-eslint/typescript-eslint/pull/12803), open | ✅ (no tsc dependency) | ✅ **requires** TS 7 | ❌ (the ESLint half needs TS 6) |

## 2. Candidate stacks

### Stack A: oxc-first, TS 7 only (recommended [analysis])

**Tools:**
- `typescript@7.0.2` as the **only** TypeScript.
- `oxlint@1.90` + `oxlint-tsgolint@7.0.2005` with `typeAware: true, typeCheck: true`. One TS 7 program serves both lint and typecheck ([stable post](https://github.com/oxc-project/website/blob/main/src/blog/2026-07-22-type-aware-linting-stable.md)).
- `jsPlugins`:
  - `eslint-plugin-sonarjs` (`cognitive-complexity`)
  - `eslint-plugin-boundaries`
  - a local `ban-throw` rule
- `oxfmt@0.75`.
- Stylelint 17.
- dependency-cruiser in CI.
- knip.
- lefthook.

**Coverage:**
- About 97% of Stack B's rules. You lose typed `naming-convention` and `prefer-destructuring`, and typed third-party ESLint plugins, because oxlint cannot run custom type-aware rules ([js-plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)).
- **Lost:**
  - The typed `@eslint-react` rules.
  - Typed `@vitest/eslint-plugin` rules (peer `typescript >=6`).
  - `@tanstack/eslint-plugin-router` and `-query`. These are untyped, so they probably run as jsPlugins **[uncertain]**.
- **Gained:**
  - Native React Compiler rules.
  - Native jsx-a11y.
  - Native `import/no-cycle`.
  - No TS 6 alias.
  - Typecheck and lint share one program.

**Speed:** tsgolint self-reports 12–18x faster than ESLint + typescript-eslint ([tsgolint README](https://github.com/oxc-project/tsgolint)). This also makes pre-commit type-aware linting realistic [analysis].

**Risks:**
- JS plugins are **alpha** ("remain under active development").
- oxfmt is **beta** (2026-02-24).
- `strict-boolean-expressions` is 🚧.
- tsgolint's version is pinned to the exact TS patch (`7.0.2xxx` = TS 7.0.2), so a TS upgrade waits on a tsgolint release.
- Maintenance is a single vendor (VoidZero/oxc).

### Stack B: ESLint-max, TS 7 for tsc plus TS 6 alias for lint (most complete, slowest)

**Tools:**
- `@typescript/native` (TS 7) for `tsc`, and `typescript` aliased to `@typescript/typescript6`.
- ESLint 10.13 with:
  - typescript-eslint `strictTypeChecked` + `stylisticTypeChecked`
  - sonarjs
  - boundaries
  - react-hooks 7
  - `eslint-plugin-jsx-a11y-x` or jsx-a11y via `--force` peers
  - unicorn 79
  - `@vitest/eslint-plugin`
  - `eslint-plugin-playwright`
  - `@tanstack/eslint-plugin-router`
  - `@cspell/eslint-plugin`
  - `eslint-plugin-functional` (optional, for immutability in the engine)
- Prettier 3.9 with eslint-config-prettier, Stylelint, dependency-cruiser, knip, lefthook.

**Pros:**
- Every rule exists, and options are fully documented.
- You can write custom **type-aware** rules, e.g. a "must-use Result" rule (the earlier doc's open problem).
- The most mature editor integration.

**Cons:**
- Slowest.
- Two TS versions: the lint program is TS 6 and the build is TS 7. **[analysis]** TS 7 is a port with the same semantics, and Microsoft documents this split officially, but diagnostics can still differ at the edges.
- jsx-a11y ESLint 10 support is blocked upstream.

**TS 7 readiness:** blocked until typescript-eslint ships the TS 7.1 backend. PR #12803 is called "EXPERIMENTAL_backend… over IPC". Joshua Goldberg's 2026-09-29 status on [#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940): "looking more and more stable". TS 7.1 itself is beta.

### Stack C: hybrid, oxlint first then a thin ESLint pass (max coverage with most of the speed)

Stack A, plus ESLint 10 + typescript-eslint (TS 6 alias) running **only** the rules oxlint lacks:
- `naming-convention`
- `no-restricted-syntax` (throw ban)
- typed `@eslint-react` (optional)
- a custom type-aware "must-use Result" rule (optional)

`eslint-plugin-oxlint@1.90` (`buildFromOxlintConfigFile`) turns off overlapping ESLint rules. Its README says to run `oxlint && eslint` and to put the oxlint config last ([repo](https://github.com/oxc-project/eslint-plugin-oxlint)).

**Pros:** full coverage, and the fast path catches most issues first.

**Cons:**
- Two linters, two configs, and still the TS 6 alias.
- ESLint still builds a full TS program for even one typed rule, so the speed gain is smaller than it looks [analysis].
- The README doesn't say whether eslint-plugin-oxlint also disables the *type-aware* overlaps **[uncertain]**. Verify that the generated config turns off `@typescript-eslint/no-floating-promises` etc.

**Use when:** you really need a custom type-aware rule.

### Not a candidate: Biome as the sole linter

- Its typed rules are nursery ("experimental and the behavior can change at any time").
- It has no cyclomatic-complexity rule and no React Compiler rules.
- `only-throw-error` is not type-based.
- **[analysis]** Biome's own inference engine does not use tsc. That is an advantage for TS 7 independence, but it is not semantically equal to tsc, as the open `useExhaustiveSwitchCases` cross-module bug shows.
- The Biome *formatter* is a valid alternative to Prettier/oxfmt. Its `noImportCycles` and `noUndeclaredClasses`/`noUnusedClasses` (nursery, CSS Modules) are interesting add-ons. Mixing it in adds a third config, though.

### Trade-off summary

| | Stack A (oxc) | Stack B (ESLint) | Stack C (hybrid) |
|---|---|---|---|
| Strictness coverage | ~97% (no typed naming-convention, no custom typed rules) | 100% + custom typed rules | 100% + custom typed rules |
| TS 7 readiness | Native, requires TS 7 | Needs TS 6 alias until TS 7.1 + typescript-eslint backend | Needs TS 6 alias |
| Speed (typed lint) | Fastest (12–18x per vendor) | Baseline | Between the two |
| Maturity risk | JS plugins alpha, oxfmt beta | Lowest; jsx-a11y ESLint 10 gap | Highest config complexity |
| Configs to maintain | `.oxlintrc` + Stylelint + depcruise | `eslint.config` + Prettier + Stylelint + depcruise | Both lint configs |

## 3. Linters: per-tool notes

### ESLint 10.13.0 + typescript-eslint 8.72.1

- ESLint 10 is the only supported line; v9 is EOL as of 2026-08-06 ([version support](https://eslint.org/version-support/)).
- typescript-eslint's peer is `typescript >=4.8.4 <6.1.0` ([dependency versions](https://typescript-eslint.io/users/dependency-versions/)). The TS 7.0.2 support issue [#12518](https://github.com/typescript-eslint/typescript-eslint/issues/12518) was closed "not_planned" because "there is no TS 7 API at this time". Tracking continues in [#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940).
- Plugins and ESLint 10 peers:

| Plugin | Version | ESLint 10 peer | Notes |
|---|---|---|---|
| eslint-plugin-unicorn | 79.0.0 | `eslint >=10.4` | ESLint 10 only |
| eslint-plugin-regexp | 3.3.2 | yes | |
| @vitest/eslint-plugin | 1.6.28 | yes | Peer `typescript >=6.0.0` |
| eslint-plugin-playwright | 2.12.1 | yes | |
| @tanstack/eslint-plugin-router | 1.162.0 | yes | |
| @tanstack/eslint-plugin-query | 5.105.0 | yes | Peer TS `^5.6 \|\| ^6 \|\| ^7` |
| @eslint-react/eslint-plugin | 5.28.8 | yes | |
| eslint-plugin-functional | 10.0.1 | yes | |
| eslint-plugin-perfectionist | 5.13.0 | yes | |
| eslint-plugin-de-morgan | 2.3.0 | yes | |
| @cspell/eslint-plugin | 10.4.0 | yes | |
| @convex-dev/eslint-plugin | 5.0.1 | — | Peer `convex ^1.43` |

- `eslint-plugin-react-compiler` is superseded. Its latest is 19.1.0-rc.2 from 2025-05; use react-hooks 7.x instead.
- eslint-plugin-css-modules 2.12.0 dates from 2023-10, so it is stale. Use generated `.d.ts` instead (section 5).

### oxlint 1.90.0 + oxlint-tsgolint 7.0.2005

**Status and size:**
- 872 rules total, 111 on by default ([rules](https://oxc.rs/docs/guide/usage/linter/rules.html)).
- Type-aware linting has been **stable since 2026-07-22**, tracking TS 7.0.2 with 59/61 rules ([post](https://github.com/oxc-project/website/blob/main/src/blog/2026-07-22-type-aware-linting-stable.md)).
- tsgolint's README says it takes no rules beyond what typescript-eslint has ([README](https://github.com/oxc-project/tsgolint)).

**Requirements** ([type-aware](https://oxc.rs/docs/guide/usage/linter/type-aware.html)):
- TS 7.0+.
- No `baseUrl`.
- The root tsconfig should use `"files": []`.
- Very large codebases may use a lot of memory.

**Configuration:**
- Type-aware rules take the same options as typescript-eslint.
- `--debug timings` gives per-rule timings.
- The config supports `extends`, `overrides[].files` (each can set `rules` and `jsPlugins`), `settings` passed through to JS plugins, and `ignorePatterns` ([config reference](https://oxc.rs/docs/guide/usage/linter/config-file-reference.html)). Also `oxlint.config.ts`.

**Native rule highlights for this project:**
- `import/no-cycle`.
- `complexity` and the `max-*` rules.
- `no-restricted-imports` with `patterns` (`group`, `regex`, `importNames`, `importNamePattern`). `allowTypeImports` exists only for `paths`, not patterns ([rule](https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-restricted-imports.html)).
- `no-restricted-globals`.
- `no-restricted-types`.
- 36 jsx-a11y rules.
- React Compiler rules: `purity`, `immutability`, `refs`, `set-state-in-render`, `static-components`, …
- unicorn, vitest, promise and jsdoc rule sets.

**Missing:**
- `no-restricted-syntax`.
- `import/no-restricted-paths`. It has an open issue, [oxc#13789](https://github.com/oxc-project/oxc/issues/13789).
- Native boundaries and sonarjs rules.

**JS plugins (alpha since 2026-03-11):**
- Conformance: ESLint built-ins 100%, react-hooks 100%, sonarjs 99.6% (excluding typed rules), testing-library 100%.
- No custom type-aware rules and no custom parsers.
- Windows OOM is a known issue ([post](https://github.com/oxc-project/website/blob/main/src/blog/2026-03-11-oxlint-js-plugins-alpha.md)).
- **[analysis]** A local `ban-throw` rule (`ThrowStatement` visitor) is trivial with this API, and it can be scoped through `overrides`.

### Biome 2.6.4 (2026-10-28; 2.6 announced 2026-10-15)

**What 2.6 brings** ([v2.6 post](https://biomejs.dev/blog/biome-v2-6/)):
- 59 nursery rules promoted.
- Markdown, SCSS and YAML support.
- JS plugins in developer preview, running on the `boa` runtime.
- `biome migrate stylelint`.
- A salsa-based inference engine.

**Typed rules:** the `types` domain has about 21 rules. Only 4 are stable (`noUnnecessaryConditions`, `useArrayFind`, `useArraySortCompare`, `useConsistentEnumValueType`). `noFloatingPromises`, `noMisusedPromises`, `useStrictBooleanExpressions`, `useExhaustiveSwitchCases` and `noUnsafeReturn` are all nursery ([domains](https://biomejs.dev/linter/domains/)).

**Project domain** (stable; turning these on activates the scanner):
- `noImportCycles`
- `noPrivateImports` (recommended)
- `noUndeclaredDependencies`
- `noUnresolvedImports`
- `noDeprecatedImports`

**Plugins:**
- GritQL plugins target JS, CSS and JSON. They can be scoped with `includes` globs.
- They run on every file and cannot see the semantic model ([plugins](https://biomejs.dev/linter/plugins/)).

**Per-folder config:** `overrides[].includes` plus a `linter` block, so per-folder `noRestrictedImports` works ([configuration](https://biomejs.dev/reference/configuration/)). `noRestrictedImports` gained `patterns` in 2.2.0 ([rule](https://biomejs.dev/linter/rules/no-restricted-imports/)).

**Ports from other plugins** ([rule sources](https://biomejs.dev/linter/rules-sources/)):
- jsx-a11y: 33 rules.
- react-hooks: 2 rules.
- sonarjs: 2 rules (`cognitive-complexity`, `prefer-while`).

**TS 7 readiness:** the 2026 roadmap does not mention tsgo or TS 7 ([roadmap](https://biomejs.dev/blog/roadmap-2026/)). Biome needs no tsc at all.

### Deno lint 2.9.6

- The plugin API is ESLint-shaped but "still evolving". Plugins are configured through `deno.json` ([docs](https://docs.deno.com/runtime/reference/lint_plugins/)).
- It has no type-aware rules **[uncertain: none documented]**.
- **Not suitable** for a pnpm/Vite app [analysis].

### rslint 0.9.5 (2026-10-09)

- Rspack/web-infra-dev's linter, **forked from tsgolint** and built on typescript-go.
- It claims "600+ rules", "all typescript-eslint rules", ESLint flat config, and "Best Effort ESLint Compatible" ([repo](https://github.com/web-infra-dev/rslint)).
- It is pre-1.0. **[analysis]** Worth watching as the second tsgo-based linter, but too young for a template.

## 4. Formatters

| Tool | Version / status | CSS | Notes |
|---|---|---|---|
| Prettier | 3.9.10 (2026-10-10), stable | CSS, SCSS, Less | The reference. Pair with `eslint-config-prettier` 10.1.8 in Stack B |
| oxfmt | 0.75.0, **beta** since 2026-02-24 | CSS, SCSS, Less (also HTML, Markdown, YAML, TOML, GraphQL) | "passes 100% of Prettier's JavaScript and TypeScript conformance tests". Built-in import sorting and `package.json` sorting. `oxfmt --migrate prettier`. Claims more than 30x faster than Prettier ([beta post](https://github.com/oxc-project/website/blob/main/src/blog/2026-02-24-oxfmt-beta.md)) |
| Biome formatter | 2.6.4, stable | CSS (CSS Modules syntax auto-enabled for `.module.css`), SCSS since 2.6 | Markdown about 92% Prettier-compatible ([v2.6](https://biomejs.dev/blog/biome-v2-6/)) |
| dprint | 0.64.3 | Through third-party Wasm plugins (Malva, Lax CSS) | Official plugins cover TS/JSON/Markdown/TOML only. It can wrap Prettier and Biome ([plugins](https://dprint.dev/plugins/)). [analysis] Extra indirection for no gain here |

**[analysis]** Formatting carries the least risk of any choice, because swapping formatters is a one-commit reformat. Use oxfmt in Stack A, since import sorting replaces `perfectionist`/`simple-import-sort`. Use Prettier if you want zero beta tools.

## 5. CSS linting and CSS Modules

**Stylelint 17.16.0.**
- 17.x is ESM-only, needs Node ≥20.19, and the default `--fix` mode is now `strict` ([migration](https://stylelint.io/migration-guide/to-17)).
- **[analysis] Strict, tested combination:**

| Package | Version | Role |
|---|---|---|
| `stylelint-config-standard` | 40.0.0 | Base config |
| `stylelint-config-css-modules` | 4.6.0 | Allows `:global`, `composes`, `@value` |
| `stylelint-order` | 8.1.2 | Property ordering, with `stylelint-config-recess-order` 7.9.0 (grouped) **or** `stylelint-config-clean-order` 10.0.0 |
| `stylelint-plugin-use-baseline` | 1.4.8 | Flags non-Baseline CSS |
| `stylelint-declaration-strict-value` | 1.12.1 | Forces `var(--token)` for colours, spacing, z-index |
| `stylelint-use-logical` | 2.1.3 | Logical properties (helps RTL and a11y) |
| `stylelint-value-no-unknown-custom-properties` | 6.1.1 | Catches unknown custom properties |
| `stylelint-high-performance-animation` | 2.0.0 | Only cheap properties in animations |
| `@double-great/stylelint-a11y` | 3.8.1 | Maintained a11y fork. The original `stylelint-a11y` is from 2020 and peers Stylelint ≤13 |
| `stylelint-plugin-defensive-css` | 2.9.7 | Optional |

- Built-in rules to tighten:
  - `selector-max-specificity`
  - `selector-max-compound-selectors`
  - `selector-class-pattern` (camelCase, to match CSS Modules named imports)
  - `declaration-no-important`
  - `color-named: never`

**Biome CSS lint.** It is on by default for CSS and has a growing CSS rule set; `noUnusedClasses` and `noUndeclaredClasses` are nursery. **[analysis]** It doesn't yet match Stylelint plugins for ordering or token enforcement.

**@eslint/css 2.0.1.** It has 15 rules, including `use-baseline`, `no-invalid-properties`, `prefer-logical-properties` and `selector-complexity`. It has no ordering rules and documents no CSS Modules support ([repo](https://github.com/eslint/css)). It is only relevant in Stack B, and even there Stylelint does more.

**Typed CSS Modules.**
- `vite-css-modules` 1.16.1 (peer Vite ^8) with `generateSourceTypes: true` writes a `.d.ts` next to each module.
- A typo in a `composes` class fails the build ([repo](https://github.com/privatenumber/vite-css-modules)).
- **[analysis]** With generated `.d.ts`, `styles.missing` becomes a TS error. That is better than any lint rule. `typed-css-modules` (2024-01) is stale. `typescript-plugin-css-modules` 5.3.0 is a tsserver plugin, and TS 7 has no plugin API yet **[uncertain]**.

## 6. Accessibility linting

| Option | Rules | ESLint 10 / TS 7 | Notes |
|---|---|---|---|
| eslint-plugin-jsx-a11y 6.10.2 | ~39 (upstream) | ❌ peer `≤ ^9`, [#1075](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/issues/1075) open | Maintainer says v10 support will come "eventually" ([#1094](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/issues/1094)) |
| eslint-plugin-jsx-a11y-x 0.2.0 (2026-05-10) | fork | ✅ peer `^9 \|\| ^10` | Small fork **[uncertain: maintenance depth]** |
| oxlint native jsx-a11y | 36 | ✅ / ✅ | Native, so no ESLint peer problem |
| Biome a11y group | 33 ported from jsx-a11y | ✅ / ✅ | Also covers HTML files |

**[analysis]** No linter can check a canvas. The real a11y gates are:
- Playwright `toMatchAriaSnapshot` (earlier doc).
- `@axe-core/playwright` scans in E2E **[not version-checked]**.
- Stylelint a11y, contrast tokens, and `prefers-reduced-motion`.

Lint-level JSX a11y is necessary but shallow.

## 7. Architecture and structure tools

### dependency-cruiser 18.7.0

- It needs the TS compiler API for TS sources. With TS 7 alone it falls back to the swc/acorn parsers, which have gaps: `.mts` files are skipped and `export type … from` is not treated as type-only ([#1104](https://github.com/sverweij/dependency-cruiser/issues/1104)).
- TS 7 support:
  - The maintainer says 7.1 is "the earliest dependency-cruiser can support typescript 7.x out of the box".
  - A TS 7.1-beta facade shipped as **`dependency-cruiser@18.8.0-beta-1`**.
  - Installing just `@typescript/typescript6` is also being made to work.
  - Source: [#1112](https://github.com/sverweij/dependency-cruiser/issues/1112).
- **[analysis]** In Stack A, either:
  - add `@typescript/typescript6` as a dev dependency for depcruise only, or
  - rely on oxlint `import/no-cycle` + boundaries and drop depcruise until 18.8 is stable.

### eslint-plugin-boundaries 7.4.0

- Works in ESLint and in oxlint `jsPlugins`.
- Under oxlint it needs the `import/resolver` setting (`typescript: true`), or every import is flagged `no-unknown` ([#431](https://github.com/javierbrea/eslint-plugin-boundaries/issues/431)).

### Sheriff 0.20.0 (`@softarc/sheriff-core`, 2026-09-29)

- Framework-agnostic module boundaries. Each module's public API is its `index.ts`, and tags plus dependency rules control who may import what.
- It runs from a CLI or through `@softarc/eslint-plugin-sheriff` ([repo](https://github.com/softarc-consulting/sheriff)).
- Peer: `typescript >=4.8`; the ESLint plugin peers `@typescript-eslint/utils`.
- **[uncertain]** I did not confirm whether it runs under a TS 7-only install. It probably needs the TS 6 alias.
- **[analysis]** It is a nicer encapsulation model ("only import a feature's `index.ts`") than boundaries' path patterns, but it ties you to the ESLint and TS API path.

### knip 6.44.0

- v6 (2026-03-20) **replaced the TypeScript backend with `oxc-parser`/`oxc-resolver`**, making it 2–4x faster ([v6 post](https://knip.dev/blog/knip-v6)). Its dependencies no longer include `typescript`, so it is TS 7-safe [analysis from npm deps].
- It finds unused files, exports, dependencies and types. The `classMembers` check was dropped.

### Biome and oxlint equivalents

- Biome: `noImportCycles`, `noPrivateImports` (JSDoc visibility), `noUndeclaredDependencies`.
- oxlint: `import/no-cycle`, `no-restricted-imports` patterns per override.

## 8. Other strictness tools

| Tool | Version | Verdict |
|---|---|---|
| type-coverage | 2.30.4 | Its peer now lists TS 7, but **it crashes on TS 7** because there is no API ([#150](https://github.com/plantain-00/type-coverage/issues/150)). Needs the TS 6 alias. **[analysis]** Largely redundant once `no-unsafe-*` and `no-explicit-any` are errors; skip it |
| @arethetypeswrong/cli | 0.18.5 | **Irrelevant.** It checks *published package* type exports, and this is a closed-source app |
| publint | 0.3.25 | **Irrelevant** for the same reason (package publishing lint) |
| pnpm catalogs | built in | `catalogMode: strict` is available; `catalogPrune` replaces the deprecated `cleanupUnusedCatalogs` ([pnpm catalogs](https://pnpm.io/catalogs)). **[analysis]** In a single-package app, catalogs plus a pinned `packageManager` make syncpack unnecessary |
| syncpack | 15.3.3 | Only useful for monorepo version alignment beyond what catalogs cover |
| @commitlint/cli | 21.2.4 | Fine with config-conventional. Optional for a solo or closed project |
| lefthook | 2.2.2 (2026-10-13) | **Preferred.** A Go binary with one YAML file, parallel jobs and `{staged_files}`, so no lint-staged is needed |
| husky + lint-staged | 9.1.7 (2024-11-18) + 17.6.0 | Works, but husky has had no release in about 2 years. Two packages instead of one |
| cspell | 10.4.0 | Yes. Use the CLI in CI and pre-commit. `@cspell/eslint-plugin` exists for Stack B |
| eslint-plugin-react-hooks | 7.1.1 | Stack B: `recommended` includes the Compiler diagnostics and does not require the compiler. Stack A: use oxlint's native ports |

## 9. TypeScript version options: what each loses

| Option | Lint | Typecheck | What you lose |
|---|---|---|---|
| **TS 6 only** | typescript-eslint (all) | `tsc` 6, slow | TS 7 speed (about 8–12x builds). oxlint type-aware is impossible (it requires TS 7). Lags TanStack/Vite defaults that assume TS 7 [analysis] |
| **TS 7 + TS 6 alias** (Microsoft's documented setup) | typescript-eslint on TS 6 | `tsc` 7 | Two compilers that may disagree at the edges. Install footprint. Alias clutter. type-coverage, Sheriff and depcruise stay on TS 6. You migrate again once the TS 7.1 API lands |
| **TS 7 + oxlint/tsgolint** | oxlint (61/63 typed rules) | `oxlint --type-check` or `tsc` 7 | `naming-convention`, `prefer-destructuring`, custom typed rules, and typed ESLint plugins. TS-API tools (type-coverage, Sheriff, depcruise without beta) need TS 6 or must be dropped. tsgolint is pinned per TS patch |

**[analysis] Expected trajectory.** TS 7.1 is in beta with a new API. typescript-eslint PR #12803 and dependency-cruiser 18.8 beta both target it. In roughly one TS release cycle, the alias problem should disappear for Stack B. Stack A has no such dependency.

## 10. Recommendation [analysis]

**Stack A (oxc-first, TS 7 only)** for the template:
- `oxlint` + `oxlint-tsgolint`, with options:
  - `strict-boolean-expressions` set to its strictest options
  - `switch-exhaustiveness-check`
  - all no-unsafe-*
  - `only-throw-error`
  - `complexity` (max 10, modified)
  - `import/no-cycle`
  - jsx-a11y and React Compiler at `error`
- `jsPlugins`: `sonarjs` (cognitive-complexity 15), `boundaries`, and a local `ban-throw` rule.
- `oxfmt`.
- Stylelint 17 with the config list in section 5, plus `vite-css-modules` typed classes.
- knip 6.
- lefthook.
- cspell.
- dependency-cruiser through `@typescript/typescript6` **only if** you want its graph and report output.

**The main trade-off:** you give up the last ~3% of typed rules (notably `naming-convention`) and the option to write custom type-aware rules. You also accept alpha/beta status on JS plugins and oxfmt. In return you get no TS 6 alias, one TS 7 program for lint and typecheck, an order-of-magnitude faster typed lint (pre-commit friendly), and native a11y and React Compiler rules unaffected by jsx-a11y's ESLint 10 gap.

**Fallback:** if a must-have typed custom rule appears (e.g. must-use `Result`), move to **Stack C** by adding a thin ESLint pass. Revisit pure Stack B once typescript-eslint ships TS 7.1 support.
