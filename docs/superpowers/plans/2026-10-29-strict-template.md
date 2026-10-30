# Strict Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the strict, machine-enforced project template for the NAND logic simulator, plus a thin vertical slice (2 inputs → 1 NAND → 1 output) that proves every architectural seam works end to end.

**Architecture:** TanStack Start in SPA mode builds a static app. Feature folders (`src/features/<feature>/{domain,application,adapters,ui}`) talk only through each feature's `index.ts`. The simulation engine is pure TypeScript on typed arrays running in a Web Worker behind a Zod-validated message protocol. Editor state is a Zustand store changed only by typed actions. Canvas 2D draws outside React. React Aria sits behind `src/shared/ui`. Errors are `Result` values with discriminated unions.

**Tech Stack:** pnpm, Node LTS, TypeScript 7 (native `tsc`), TanStack Start + Router (SPA mode), Vite 8, React 19, Zustand, Zod 4, idb, React Aria Components, Paraglide JS, vite-plugin-pwa, oxlint + oxlint-tsgolint (+ jsPlugins: sonarjs, eslint-plugin-boundaries, local rule), oxfmt, Stylelint, vite-css-modules, knip, cspell, lefthook, commitlint, Vitest, fake-indexeddb, Playwright, @axe-core/playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-29-strict-template-design.md` (decisions in `docs/adr/0001`–`0036`, terms in `GLOSSARY.md`, versions and config facts in `docs/research/`).

## Global Constraints

- No Tailwind, no CSS-in-JS. Pure CSS and CSS Modules only (spec §3, §5).
- TypeScript 7 only, no TS 6 alias. Every strict flag on except `verbatimModuleSyntax` (ADR 24, spec §5).
- `throw` is banned in `src/features/simulation/**` (except `adapters/`) and `src/features/*/domain/**`. `convex/**` may only `throw new ConvexError(...)`. Adapters may catch library exceptions and convert them to `Result` (ADR 28, 36).
- Each feature exposes only `index.ts`. No feature imports another feature's internals. `simulation` imports no React, DOM or other feature. `shared` imports no feature. Only `src/shared/ui/**` imports `react-aria-components` / `react-aria`. No import cycles (ADR 23).
- Zod validates only at trust boundaries: file import, IndexedDB reads, URL search params, worker messages (ADR 27).
- Every entity ID is a branded UUID from `crypto.randomUUID()`. Names are display-only (ADR 11).
- Every user-facing string goes through Paraglide in `en` and `es` (ADR 17, 19).
- 95% branch coverage on `src/features/simulation/**` (excluding `adapters/`), `src/features/*/domain/**` and `src/shared/**` (excluding `src/shared/ui/**`) (ADR 32, spec §6.1).
- Supported browsers: last 2 versions of iOS/iPadOS Safari, Android Chrome, desktop Chrome/Edge/Firefox/Safari (ADR 34).
- The save format is a draft (`version: 1`) and may be reset until the first external share (ADR 33).
- Respect `prefers-reduced-motion`. WCAG 2.2 AA (ADR 3, 10).
- `Digital-Logic-Sim.app` is git-ignored and never committed.
- Conventional Commits. Every task ends with a commit on the feature branch.
- Pin every dependency in pnpm catalogs (`catalogMode: strict`). Use current stable versions at setup time (the research docs list the October 2026 versions).

## Review Focus

1. **A bad import file** (invalid JSON, wrong shape, `version` missing / older / newer than supported, multi-MB file) → a typed, translated error and no state change. Owned by Task 9.
2. **Malformed URL search params** (`?zoom=abc`, `?zoom=999`, an unknown `chip` id) → defaults applied, no crash. Owned by Task 8.
3. **IndexedDB unavailable or corrupt** (private browsing, quota exceeded, a stored record that no longer parses) → the app keeps working in memory and shows a translated error; a corrupt record returns `Corrupt`, not a crash. Owned by Task 10.
4. **Oscillating or racing circuits** (a NAND feeding itself, an SR latch released from 0/0) → every `tick()` is bounded, the UI never hangs, and the latch settles with a seed-determined winner. Owned by Task 11.
5. **Theme legibility** (high-contrast and dark themes, signal-high vs signal-low vs background, text vs surface) → meets WCAG contrast (4.5:1 for text, 3:1 for signal/UI marks); reduced motion disables animation. Owned by Task 6.

---

## File Structure

```
.github/workflows/ci.yml                 CI: check, e2e matrix, visual
.gitignore  .nvmrc  package.json  pnpm-workspace.yaml (catalogs)
tsconfig.json                            strictest TS 7 config
vite.config.ts                           TanStack Start (SPA), css modules, PWA, paraglide
.oxlintrc.json  .oxfmtrc.json  .stylelintrc.json  knip.json  cspell.json
lefthook.yml  commitlint.config.ts  vitest.config.ts  playwright.config.ts
project.inlang/settings.json  messages/en.json  messages/es.json
deploy/README.md  deploy/nginx.conf  deploy/.htaccess  deploy/vercel.json  deploy/_redirects
tooling/lint-rules/no-throw-in-domain.js      local oxlint JS plugin rule
tooling/lint-canaries/**                       files that must fail lint
scripts/check-lint-canaries.ts                 asserts each canary fails with its rule
scripts/generate-theme-css.ts                  writes theming tokens CSS from TS data
src/
  router.tsx  routes/__root.tsx  routes/index.tsx  routes/projects.$projectId.tsx
  shared/result.ts  shared/assert-never.ts  shared/ids.ts
  shared/ui/{Button,Switch,Select,Toolbar,index}.tsx + *.module.css
  i18n/paraglide/ (generated, git-ignored)  i18n/locale.ts
  features/
    theming/{index.ts, domain/themes.ts, domain/contrast.ts, adapters/apply-theme.ts, ui/ThemePicker.tsx, tokens.css (generated, committed)}
    projects/{index.ts, domain/model.ts, domain/format.ts, domain/migrations.ts, domain/demo.ts, domain/errors.ts, adapters/project-file.ts, fixtures/v1-demo.json}
    persistence/{index.ts, domain/errors.ts, adapters/idb-project-repository.ts, adapters/storage-persist.ts}
    simulation/{index.ts, domain/prng.ts, domain/netlist.ts, domain/engine.ts, domain/protocol.ts, adapters/engine.worker.ts, adapters/engine-client.ts}
    circuit-editor/{index.ts, domain/actions.ts, domain/reducer.ts, domain/history.ts, domain/to-netlist-source.ts, application/editor-store.ts, adapters/canvas-renderer.ts, ui/CircuitCanvas.tsx, ui/EditorToolbar.tsx}
    accessibility/{index.ts, ui/CircuitSummary.tsx}
e2e/{slice.spec.ts, a11y.spec.ts, keyboard.spec.ts, offline.spec.ts, visual.spec.ts, import-export.spec.ts}
```

Unit tests sit next to their source as `*.test.ts`.

---

### Task 1: Scaffold the app with the strictest TypeScript

**Files:**
- Create: `.nvmrc`, `.gitignore`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `vite.config.ts`, `src/router.tsx`, `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/styles/global.css`
- Modify: `CLAUDE.md` (append a `## Commands` section)

**Interfaces:**
- Produces: scripts `dev`, `build`, `preview`, `typecheck`. Build output contains `_shell.html`.

- [ ] **Step 1: Pin the toolchain.** Run `nvm ls-remote --lts | tail -1` and write that major version to `.nvmrc`. Set `"packageManager": "pnpm@<current>"` and `"engines": { "node": ">=<major>" }` in `package.json`. In `pnpm-workspace.yaml`, set `catalogMode: strict` and declare every dependency version in `catalog:`. `package.json` references deps only as `catalog:`.
- [ ] **Step 2: Scaffold TanStack Start + React by hand** (not a template that pulls Tailwind). Use `tanstackStart({ spa: { enabled: true } })` in `vite.config.ts` and `@vitejs/plugin-react` with the React Compiler babel plugin enabled. If the compiler conflicts with TanStack Start, leave it off and note why in `CLAUDE.md`. Import global CSS via `import globalCss from "../styles/global.css?url"` and add it to the root route's `head().links`.
- [ ] **Step 3: Write `tsconfig.json`** with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `allowUnreachableCode: false`, `allowUnusedLabels: false`, `erasableSyntaxOnly`, `isolatedModules`, `noUncheckedSideEffectImports`, `forceConsistentCasingInFileNames`, `types: ["vite/client"]`, `verbatimModuleSyntax: false` (TanStack Start guidance). Path alias `~/*` → `src/*`.
- [ ] **Step 4: Add `.gitignore`** entries: `node_modules`, `dist`, `.output`, `.tanstack`, `*.app/`, `.DS_Store`, `src/i18n/paraglide`, `coverage`, `test-results`, `playwright-report`.
- [ ] **Step 5: Verify.** Run `pnpm install && pnpm typecheck && pnpm build`. Expected: no errors; `find .output dist -name _shell.html` prints one path. Run `pnpm preview` and open it: the index route renders a heading.
- [ ] **Step 6: Commit** `chore: scaffold TanStack Start SPA with strict TS 7`.

### Task 2: Shared kernel (Result, assertNever, branded IDs) and Vitest

**Files:**
- Create: `src/shared/result.ts`, `src/shared/assert-never.ts`, `src/shared/ids.ts`, `vitest.config.ts`
- Test: `src/shared/result.test.ts`, `src/shared/ids.test.ts`

**Interfaces:**
- Produces:
  - `type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E }`
  - `ok<T>(value: T): Result<T, never>`, `err<E>(error: E): Result<never, E>`, `isOk`, `isErr` (type guards), `mapResult<T, U, E>(r: Result<T, E>, f: (t: T) => U): Result<U, E>`
  - `assertNever(value: never): never` (the only file in `src/shared` allowed to throw; it is for unreachable cases)
  - Zod branded schemas plus types: `ProjectIdSchema`/`ProjectId`, `ChipIdSchema`/`ChipId`, `InstanceIdSchema`/`InstanceId`, `PinIdSchema`/`PinId`, `WireIdSchema`/`WireId`. Each is `z.uuid().brand<"X">()`. Factories: `newProjectId()`, `newChipId()`, `newInstanceId()`, `newPinId()`, `newWireId()`, which call `crypto.randomUUID()`.

- [ ] **Step 1: Write failing tests.**

```ts
test("ok/err narrow via isOk", () => {
  const r: Result<number, string> = ok(1);
  expect(isOk(r) && r.value).toBe(1);
  expect(isErr(err("x"))).toBe(true);
});
test("mapResult maps ok and passes err through", () => {
  expect(mapResult(ok(2), (n) => n * 2)).toEqual({ ok: true, value: 4 });
  expect(mapResult(err("e"), (n: number) => n)).toEqual({ ok: false, error: "e" });
});
test("branded ids reject non-uuids and accept generated ids", () => {
  expect(ChipIdSchema.safeParse("nope").success).toBe(false);
  expect(ChipIdSchema.safeParse(newChipId()).success).toBe(true);
});
test("ids of different kinds are not assignable (type-level)", () => {
  // @ts-expect-error PinId is not a ChipId
  const _c: ChipId = newPinId();
});
```

- [ ] **Step 2: Run `pnpm vitest run src/shared`.** Expected: FAIL (modules missing).
- [ ] **Step 3: Implement the three files.** In `vitest.config.ts`: environment `node`, coverage provider `v8`, and `coverage.thresholds` keyed by glob. Use `{ branches: 95 }` for `src/features/simulation/domain/**`, `src/features/*/domain/**` and `src/shared/*.ts`. Exclude `**/adapters/**`, `**/ui/**`, `src/shared/ui/**`, `src/routes/**`.
- [ ] **Step 4: Run `pnpm test`** (`vitest run --coverage`). Expected: PASS, thresholds met.
- [ ] **Step 5: Commit** `feat(shared): add Result, assertNever and branded ids`.

### Task 3: oxlint with type-aware rules, boundaries, complexity, the throw ban and lint canaries

**Files:**
- Create: `.oxlintrc.json`, `tooling/lint-rules/no-throw-in-domain.js`, `tooling/lint-canaries/**`, `scripts/check-lint-canaries.ts`
- Modify: `package.json` scripts `lint`, `lint:canaries`

**Interfaces:**
- Produces: `pnpm lint` (oxlint `--type-aware`, whole repo except `tooling/lint-canaries`), `pnpm lint:canaries`.

- [ ] **Step 1: Configure `.oxlintrc.json`.**
  - Enable categories `correctness`, `suspicious`, `pedantic`, `perf` and `style` as `error`, plus plugins `typescript`, `react`, `react-hooks`, `jsx-a11y`, `import`, `unicorn`, `promise`. Set `typeAware: true`.
  - Turn on these rules explicitly:
    - `typescript/no-floating-promises`, `typescript/no-misused-promises`, `typescript/strict-boolean-expressions`
    - `typescript/switch-exhaustiveness-check` (`considerDefaultExhaustiveForUnions: false`)
    - `typescript/only-throw-error`, `typescript/no-unsafe-*`
    - `import/no-cycle`
    - core `complexity` (max 10)
  - Add `jsPlugins` entries:
    - `eslint-plugin-sonarjs` with `sonarjs/cognitive-complexity` set to 15;
    - `eslint-plugin-boundaries` with `settings["import/resolver"] = { typescript: true }`;
    - `./tooling/lint-rules/no-throw-in-domain.js`.
  - Turn off rules that conflict with the formatter.
- [ ] **Step 2: Configure boundaries.**
  - Elements, using `**/` globs so the canaries match too: `feature` (`**/src/features/*`, captured `name`), `shared-ui` (`**/src/shared/ui`), `shared` (`**/src/shared`), `routes` (`**/src/routes`), `i18n` (`**/src/i18n`), `convex` (`**/convex`).
  - `boundaries/entry-point`: features only through `index.ts`.
  - `boundaries/element-types`:
    - `shared` may import only `shared`;
    - `feature` may import `shared`, `shared-ui`, `i18n` and other `feature` (entry point only);
    - `feature` `simulation` may import only `shared` (not `shared-ui`, not `i18n`);
    - `routes` may import anything.
  - Use `no-restricted-imports` overrides to ban:
    - `react`, `react-dom` and `@tanstack/*` inside `**/features/simulation/**`;
    - `react-aria-components` and `react-aria` outside `**/src/shared/ui/**`.
- [ ] **Step 3: Implement `no-throw-in-domain.js`.**
  - A `ThrowStatement` reports when the filename matches `/features/simulation/` (and not `/adapters/`) or `/features/[^/]+/domain/`.
  - In `/convex/`, it reports unless the argument is `NewExpression` whose callee is `ConvexError`.
  - `src/shared/assert-never.ts` is exempt.
- [ ] **Step 4: Write canaries.** Each one is a file under `tooling/lint-canaries/src/...`, mirroring real paths, with a header comment `// expect: <rule-id>`:
  - `features/simulation/domain/throws.ts` → `no-throw-in-domain`
  - `features/simulation/domain/imports-react.ts` → `no-restricted-imports`
  - `features/a/domain/reaches-into-b.ts` (imports `../../b/domain/x`) → `boundaries/entry-point`
  - `features/cycle/a.ts` + `b.ts` → `import/no-cycle`
  - `features/p/domain/floating.ts` → `typescript/no-floating-promises`
  - `features/p/domain/switch.ts` (union, missing case) → `typescript/switch-exhaustiveness-check`
  - `features/p/domain/complex.ts` (nested branches above 15) → `sonarjs/cognitive-complexity`
  - `features/p/ui/uses-aria.tsx` → `no-restricted-imports`
  - `convex/x/mutations.ts` (`throw new Error()`) → `no-throw-in-domain`
  - `features/p/ui/literal.tsx` (JSX text literal) → `react/jsx-no-literals`, if oxlint supports it. If it doesn't, drop this canary and open a GitHub issue "lint: catch hard-coded JSX strings" (spec §7.2).
- [ ] **Step 5: Implement `scripts/check-lint-canaries.ts`.** For each canary, run oxlint with `--format json` and the repo config on that file. Assert that the diagnostics contain the expected rule id. Exit 1 listing any canary that passed lint.
- [ ] **Step 6: Run `pnpm lint && pnpm lint:canaries`.** Expected: lint passes on `src/`, and every canary is reported. If a jsPlugin (sonarjs or boundaries) is unreliable, switch to the built-in fallback from spec §7.1 and open a GitHub issue for the gap.
- [ ] **Step 7: Commit** `chore(lint): add strict oxlint config, boundaries and canaries`.

### Task 4: Formatting, CSS lint, typed CSS Modules, knip, cspell

**Files:**
- Create: `.oxfmtrc.json`, `.stylelintrc.json`, `knip.json`, `cspell.json`, `tooling/lint-canaries/css/raw-color.module.css`
- Modify: `vite.config.ts` (add `vite-css-modules` with `generateSourceTypes: true`), `package.json` scripts `format`, `format:check`, `lint:css`, `knip`, `spell`, `check`

**Interfaces:**
- Produces: `pnpm check` = `typecheck && lint && lint:css && format:check && knip && spell && lint:canaries && test`.

- [ ] **Step 1: Set up oxfmt** with import sorting on. Run `pnpm format` once.
- [ ] **Step 2: Set up Stylelint.**
  - Extends: `stylelint-config-standard`, `stylelint-config-css-modules`, `stylelint-config-recess-order`.
  - Plugins: `stylelint-plugin-use-baseline`, `stylelint-declaration-strict-value` (colors, `z-index`, `font-size` must be `var(--*)`), `stylelint-use-logical`, `stylelint-value-no-unknown-custom-properties` (`importFrom: src/features/theming/tokens.css`), `stylelint-high-performance-animation`, `@double-great/stylelint-a11y`.
  - The `raw-color.module.css` canary (`color: #fff`) must fail. Add it to `check-lint-canaries.ts` with the Stylelint runner.
- [ ] **Step 3: Set up typed CSS Modules.** Generated `*.module.css.d.ts` files are git-ignored. A typo'd class in TSX must fail `pnpm typecheck`; check this once by hand.
- [ ] **Step 4: Set up knip** with entry points for routes, the worker and scripts. Set up cspell with `en` and `@cspell/dict-es-es`, files `src/**`, `messages/**` and `docs/**`, plus a project word list (`NAND`, `Lague`, `Paraglide`, `oxlint`, ...).
- [ ] **Step 5: Run `pnpm check`.** Expected: PASS.
- [ ] **Step 6: Commit** `chore: add formatter, stylelint, typed css modules, knip and cspell`.

### Task 5: Git hooks and commit messages

**Files:**
- Create: `lefthook.yml`, `commitlint.config.ts`
- Modify: `package.json` (`prepare: lefthook install`)

- [ ] **Step 1: Configure `lefthook.yml`.**
  - `pre-commit` (parallel, staged files only): oxfmt check, oxlint, stylelint on `*.css`, cspell.
  - `commit-msg`: `commitlint --edit {1}` with `@commitlint/config-conventional`.
  - `pre-push`: `pnpm check`.
- [ ] **Step 2: Verify.** Run `git commit --allow-empty -m "bad message"`; expected: rejected by commitlint. Then run `git commit --allow-empty -m "chore: hook check"`; expected: accepted. Undo it with `git reset --soft HEAD~1`.
- [ ] **Step 3: Commit** `chore: add lefthook and commitlint`.

### Task 6: Theming tokens and the UI layer

**Files:**
- Create: `src/features/theming/{index.ts, domain/themes.ts, domain/contrast.ts, adapters/apply-theme.ts, ui/ThemePicker.tsx, ui/ThemePicker.module.css}`, `scripts/generate-theme-css.ts`, `src/features/theming/tokens.css` (generated, committed), `src/shared/ui/{Button,Switch,Select,Toolbar}.tsx` + `.module.css`, `src/shared/ui/index.ts`
- Test: `src/features/theming/domain/themes.test.ts`, `src/features/theming/domain/contrast.test.ts`

**Interfaces:**
- Produces:
  - `type ThemeId = "light" | "dark" | "high-contrast"`
  - `type ThemeTokens = { readonly colorBackground; colorSurface; colorText; colorTextMuted; colorAccent; colorFocusRing; colorSignalHigh; colorSignalLow; colorWire; colorChipNand; colorChipText; colorGrid: string }`
  - `themes: Readonly<Record<ThemeId, ThemeTokens>>`
  - `tokenToCssVar(key: keyof ThemeTokens): string`, e.g. `colorSignalHigh` → `--color-signal-high`
  - `renderThemeCss(themes): string`, which emits `:root[data-theme="<id>"] { --...: ...; }` blocks
  - `contrastRatio(fg: string, bg: string): number`, implemented as the WCAG 2.x relative-luminance formula on `#rrggbb`
  - `applyTheme(root: HTMLElement, id: ThemeId): void`, which sets `data-theme`
  - `resolveInitialTheme(stored: string | null, prefersDark: boolean, prefersMoreContrast: boolean): ThemeId`
  - `ThemePicker` component
  - `src/shared/ui` exports `Button`, `Switch`, `Select`, `Toolbar`. These are thin wrappers over React Aria Components, styled with CSS Modules and tokens. Their prop types are our own, written to satisfy `exactOptionalPropertyTypes`.

- [ ] **Step 1: Write failing tests.**

```ts
test.each(themeIds)("%s: text on background and surface ≥ 4.5", (id) => {
  const t = themes[id];
  expect(contrastRatio(t.colorText, t.colorBackground)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(t.colorText, t.colorSurface)).toBeGreaterThanOrEqual(4.5);
});
test.each(themeIds)("%s: signals and focus ring vs background ≥ 3", (id) => {
  const t = themes[id];
  for (const c of [t.colorSignalHigh, t.colorSignalLow, t.colorFocusRing, t.colorWire])
    expect(contrastRatio(c, t.colorBackground)).toBeGreaterThanOrEqual(3);
});
test("high-contrast text ratio ≥ 7", () => {
  expect(contrastRatio(themes["high-contrast"].colorText, themes["high-contrast"].colorBackground)).toBeGreaterThanOrEqual(7);
});
test("contrastRatio: black on white is 21", () => expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1));
test("committed tokens.css matches renderThemeCss(themes)", () => {
  expect(readFileSync("src/features/theming/tokens.css", "utf8")).toBe(renderThemeCss(themes));
});
test.each([[null, true, false, "dark"], [null, false, true, "high-contrast"], ["light", true, true, "light"], ["bogus", false, false, "light"]])(
  "resolveInitialTheme(%s,%s,%s) → %s", (s, d, c, want) => expect(resolveInitialTheme(s, d, c)).toBe(want));
```

- [ ] **Step 2: Run the tests.** Expected: FAIL.
- [ ] **Step 3: Implement the theme data, contrast function and generator.** Use your own palette: a dark canvas, bold flat chip colors and a bright "signal high". Don't copy Lague's exact values. Run `pnpm tsx scripts/generate-theme-css.ts` to write `tokens.css`.
- [ ] **Step 4: Implement `applyTheme`, the `ThemePicker`** (a `Select` with translated labels, added in Task 7) **and the `shared/ui` wrappers.**
  - The stored preference lives in `localStorage` key `nand.theme`, with every read and write inside try/catch.
  - `global.css` imports `tokens.css`.
  - A `@media (prefers-reduced-motion: reduce)` block sets `--motion-duration: 0ms`. All transitions use `var(--motion-duration)`.
- [ ] **Step 5: Run `pnpm check`.** Expected: PASS.
- [ ] **Step 6: Commit** `feat(theming): add token themes, contrast checks and UI layer`.

### Task 7: i18n with Paraglide (en, es)

**Files:**
- Create: `project.inlang/settings.json`, `messages/en.json`, `messages/es.json`, `src/i18n/locale.ts`, `src/features/theming/ui/LanguagePicker.tsx` (or under `src/shared/ui` if it needs no feature data; your call)
- Modify: `vite.config.ts` (paraglide vite plugin, `outdir: ./src/i18n/paraglide`, strategy `["localStorage", "preferredLanguage", "baseLocale"]`), `src/routes/__root.tsx` (set `<html lang>`; wrap in React Aria `I18nProvider locale={getLocale()}`)

**Interfaces:**
- Produces: `import { m } from "~/i18n/paraglide/messages"`; `getLocale(): "en" | "es"`, `setLocale(locale)` re-exported from `src/i18n/locale.ts`. Base locale is `en`.

- [ ] **Step 1: Spike the integration.** Confirm the Paraglide vite plugin works with TanStack Start SPA mode and TS 7: a message renders, and switching locale re-renders. If it doesn't work, stop and report back before going further (spec §9 risk).
- [ ] **Step 2: Add messages** for every string so far: app title, theme names, the language picker label, "Add NAND", "Undo", "Redo", "Input A", "Input B", "Output", "Export", "Import", plus all error messages added in Tasks 9 and 10 (add them in those tasks).
- [ ] **Step 3: Verify that missing keys fail the typecheck.** Temporarily reference `m.does_not_exist()` and run `pnpm typecheck`; expected: error. Then revert.
- [ ] **Step 4: Run `pnpm check`.** Expected: PASS. cspell accepts the Spanish strings.
- [ ] **Step 5: Commit** `feat(i18n): add Paraglide with en and es`.

### Task 8: Routes with typed search params

**Files:**
- Create: `src/routes/projects.$projectId.tsx`, `src/features/circuit-editor/domain/view-search.ts`
- Modify: `src/routes/index.tsx`
- Test: `src/features/circuit-editor/domain/view-search.test.ts`

**Interfaces:**
- Produces:
  - `EditorSearchSchema`, a Zod object `{ chip: ChipIdSchema.optional().catch(undefined), zoom: z.number().min(0.25).max(4).catch(1).default(1), x: z.number().finite().catch(0).default(0), y: z.number().finite().catch(0).default(0) }`
  - `type EditorSearch = z.output<typeof EditorSearchSchema>`
  - The route `/projects/$projectId` uses `validateSearch: EditorSearchSchema`. `$projectId` is parsed with `ProjectIdSchema`, and an invalid id renders a translated "project not found" view.

- [ ] **Step 1: Write failing tests.**

```ts
test("defaults", () => expect(EditorSearchSchema.parse({})).toEqual({ zoom: 1, x: 0, y: 0 }));
test("garbage falls back", () => expect(EditorSearchSchema.parse({ zoom: "abc", x: "NaN", chip: "nope" })).toEqual({ zoom: 1, x: 0, y: 0 }));
test("out-of-range zoom falls back", () => expect(EditorSearchSchema.parse({ zoom: 999 }).zoom).toBe(1));
test("valid values kept", () => { const chip = newChipId(); expect(EditorSearchSchema.parse({ chip, zoom: 2 })).toMatchObject({ chip, zoom: 2 }); });
```

- [ ] **Step 2: Run the tests.** Expected: FAIL. **Step 3:** Implement. **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(editor): add typed editor route search params`.

### Task 9: Project model, draft save format, migrations and file import/export

**Files:**
- Create: `src/features/projects/{index.ts, domain/model.ts, domain/format.ts, domain/migrations.ts, domain/errors.ts, domain/demo.ts, adapters/project-file.ts, fixtures/v1-demo.json}`
- Test: `src/features/projects/domain/format.test.ts`, `src/features/projects/domain/migrations.test.ts`

**Interfaces:**
- Produces (in `model.ts`, as Zod schemas plus inferred types):
  - `Point = { x: number; y: number }`
  - `BuiltinKind = "nand" | "input" | "output" | "clock"`
  - `PinRef = { instanceId: InstanceId; pin: number }`
  - `ChipInstance = { id: InstanceId; kind: { type: "builtin"; builtin: BuiltinKind } | { type: "custom"; chipId: ChipId }; position: Point; label?: string }`
  - `Wire = { id: WireId; from: PinRef; to: PinRef; bitWidth: number /* int 1..16 */; waypoints: Point[] }`
  - `Circuit = { instances: ChipInstance[]; wires: Wire[] }`
  - `Chip = { id: ChipId; name: string; color: string /* #rrggbb */; circuit: Circuit; folderId?: string; tags: string[] }`
  - `Project = { id: ProjectId; name: string; seed: number /* uint32 */; rootCircuit: Circuit; chips: Chip[]; folders: { id: string; name: string }[] }`
- `format.ts`:
  - `CURRENT_FORMAT_VERSION = 1`
  - `ProjectFileSchema = { format: "nand-project"; version: 1; project: Project }`
  - `serializeProject(p: Project): string` (JSON, 2-space)
  - `parseProjectFile(text: string, chain?: MigrationChain): Result<Project, ImportError>`
  - `MAX_IMPORT_BYTES = 5_000_000`
- `migrations.ts`:
  - `type Migration = { from: number; migrate: (data: unknown) => unknown }` (it produces `from + 1`)
  - `type MigrationChain = readonly Migration[]`
  - `defaultChain: MigrationChain = []`
  - `migrateToCurrent(data: { version: number }, chain, current): Result<unknown, ImportError>`
- `errors.ts`: `type ImportError = { type: "TooLarge"; bytes: number } | { type: "InvalidJson" } | { type: "NotAProjectFile" } | { type: "UnsupportedVersion"; version: number } | { type: "FutureVersion"; version: number; supported: number } | { type: "InvalidProject"; issues: string[] }`, plus `importErrorMessage(e: ImportError): string`, which maps each case to a Paraglide message using `assertNever` in the default branch.
- `demo.ts`: `createDemoProject(name: string): Project`. It returns a root circuit with input A, input B, one NAND and one output, wired A→NAND.0, B→NAND.1 and NAND.out→Output, plus a random uint32 seed.
- `adapters/project-file.ts`: `readProjectFile(file: File): Promise<Result<Project, ImportError>>`, which checks `file.size` before reading; `downloadProjectFile(p: Project): void`.

- [ ] **Step 1: Write failing tests** (one assertion per case):
  - `serializeProject` → `parseProjectFile` round-trips `createDemoProject("x")`;
  - the committed `fixtures/v1-demo.json` parses to `ok`;
  - `"{"` → `InvalidJson`;
  - `{"foo":1}` → `NotAProjectFile`;
  - `version: 0` → `UnsupportedVersion`;
  - `version: 2` → `FutureVersion { version: 2, supported: 1 }`;
  - a wire with `bitWidth: 0` → `InvalidProject`;
  - a 5,000,001-byte string → `TooLarge`, checked before `JSON.parse`;
  - with a test chain `[{ from: 1, migrate: renameField }]` and current version 2, a v1 file is migrated and parses;
  - a chain with a gap (no migration from 1) → `UnsupportedVersion`;
  - every `ImportError` case returns a non-empty message.
- [ ] **Step 2: Run them.** Expected: FAIL. **Step 3:** Implement. **Step 4:** Run them. Expected: PASS, 95% branches.
- [ ] **Step 5: Commit** `feat(projects): add draft project format with migrations and fixtures`.

### Task 10: IndexedDB persistence

**Files:**
- Create: `src/features/persistence/{index.ts, domain/errors.ts, adapters/idb-project-repository.ts, adapters/storage-persist.ts}`
- Test: `src/features/persistence/adapters/idb-project-repository.test.ts` (uses `fake-indexeddb/auto`)

**Interfaces:**
- Consumes: `Project`, `serializeProject`, `parseProjectFile` from `~/features/projects`.
- Produces:
  - `type PersistenceError = { type: "NotFound"; id: ProjectId } | { type: "Corrupt"; id: ProjectId; cause: ImportError } | { type: "QuotaExceeded" } | { type: "Unavailable" }`
  - `persistenceErrorMessage(e): string`
  - `interface ProjectRepository { save(p: Project): Promise<Result<void, PersistenceError>>; load(id: ProjectId): Promise<Result<Project, PersistenceError>>; list(): Promise<Result<{ id: ProjectId; name: string }[], PersistenceError>> }`
  - `createProjectRepository(dbName = "nand"): ProjectRepository`. It stores the serialized file text under the store `projects`, keyed by id. On read, it goes through `parseProjectFile`, so it gets validation and migration for free.
  - `createMemoryProjectRepository(): ProjectRepository`, the fallback when IndexedDB is unavailable.
  - `requestPersistentStorage(): Promise<boolean>`

- [ ] **Step 1: Write failing tests:**
  - a save then load round-trip;
  - loading an unknown id → `NotFound`;
  - a raw corrupt record (`"{"`) → `Corrupt` with cause `InvalidJson`;
  - `list` returns saved names;
  - when `indexedDB.open` throws (stub it), `createProjectRepository` operations return `Unavailable`, not a rejection;
  - a `QuotaExceededError` `DOMException` during `put` → `QuotaExceeded`;
  - the memory repository passes the same round-trip test.
- [ ] **Step 2: Run them.** Expected: FAIL. **Step 3:** Implement with `idb`. Every `await` sits inside try/catch, and exceptions map to `PersistenceError`. **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5: Commit** `feat(persistence): add IndexedDB project repository`.

### Task 11: Simulation engine, seeded races and the worker protocol

**Files:**
- Create: `src/features/simulation/{index.ts, domain/prng.ts, domain/netlist.ts, domain/engine.ts, domain/protocol.ts, adapters/engine.worker.ts, adapters/engine-client.ts}`
- Test: `src/features/simulation/domain/{prng,netlist,engine,protocol}.test.ts`

**Interfaces:**
- Produces:
  - `createPrng(seed: number): () => number`, which returns a float in [0, 1). Use mulberry32.
  - `type NetlistSource = { inputCount: number; nands: readonly { a: SignalRef; b: SignalRef }[]; outputs: readonly SignalRef[] }`, where `SignalRef = { kind: "input"; index: number } | { kind: "nand"; index: number }`. This is the engine's own input type; the engine imports nothing from `projects`.
  - `type Netlist = { inputCount: number; nandCount: number; nandA: Int32Array; nandB: Int32Array; outputs: Int32Array }`. Signal index layout is `[inputs..., nand outputs...]`.
  - `compileNetlist(src: NetlistSource): Result<Netlist, CompileError>`, where `CompileError = { type: "SignalOutOfRange"; ref: SignalRef }`.
  - `RACE_HOLD_PROBABILITY = 0.125`
  - `createEngine(netlist: Netlist, seed: number): Engine`, where `interface Engine { setInput(i: number, v: 0 | 1): void; tick(): void; runUntilStable(maxTicks: number): { stable: boolean; ticks: number }; readOutput(i: number): 0 | 1; readonly tickCount: number }`
  - Tick algorithm (unit delay with seeded hold):

    ```
    next[k] = 1 - (sig[a[k]] & sig[b[k]]) for every NAND k   // read only the previous tick's signals
    for each k where next[k] != sig[nandBase+k]:
        if prng() < RACE_HOLD_PROBABILITY: keep old value   // seeded jitter breaks symmetric races
        else: commit next[k]
    ```

    `runUntilStable` stops at the first tick where nothing changed and nothing was held. It returns `{ stable: false }` when it hits `maxTicks`, which bounds oscillation.
  - `protocol.ts` (Zod discriminated unions):
    - `ToEngineSchema`: `{ type: "load"; source: NetlistSource; seed: number } | { type: "setInput"; index: number; value: 0 | 1 } | { type: "settle"; maxTicks: number }`
    - `FromEngineSchema`: `{ type: "state"; tick: number; stable: boolean; outputs: (0 | 1)[] } | { type: "error"; error: CompileError | { type: "BadMessage" } }`
  - `engine.worker.ts` parses every incoming message with `ToEngineSchema` (replying `BadMessage` on failure). After `load`, `setInput` or `settle`, it runs `runUntilStable(1000)` and posts `state`.
  - `createEngineClient(): EngineClient` with `send(msg: ToEngine): void`, `subscribe(cb: (msg: FromEngine) => void): () => void` and `dispose(): void`. Incoming messages are parsed with `FromEngineSchema`, and invalid ones are dropped and logged.

- [ ] **Step 1: Write failing tests:**
  - `createPrng(42)` yields the same first 5 values twice, and seeds 1 and 2 differ.
  - The NAND truth table: for all 4 input combinations, after `runUntilStable(10)` the output is `1 - (a & b)` and `stable` is true.
  - `compileNetlist` with `{ kind: "nand", index: 5 }` when only 1 NAND exists → `SignalOutOfRange`.
  - A self-loop NAND (`a = b = own output`) → `runUntilStable(200)` returns `stable: false` with `ticks: 200`, and does not hang.
  - SR latch (two NANDs cross-coupled; inputs S̄, R̄): set both to 0 and settle, then set both to 1 and `runUntilStable(500)`. Assert:
    - `stable` is true;
    - Q ≠ Q̄;
    - the same seed gives the same Q;
    - across seeds 1..50, both Q = 0 and Q = 1 occur.
  - With `RACE_HOLD_PROBABILITY` stubbed to 0 (pass it as an optional 3rd `createEngine` arg `options?: { raceHoldProbability?: number }`), the same latch release is not stable.
  - The protocol schemas reject `{ type: "setInput", index: -1, value: 2 }` and accept valid messages.
- [ ] **Step 2: Run them.** Expected: FAIL. **Step 3:** Implement the domain files. **Step 4:** Run them. Expected: PASS, 95% branches.
- [ ] **Step 5: Implement the worker and client adapters.** Load the worker with `new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" })`. The worker and client are covered by E2E in Task 13.
- [ ] **Step 6: Commit** `feat(simulation): add typed-array engine with seeded races and worker protocol`.

### Task 12: Editor actions, reducer, undo and store

**Files:**
- Create: `src/features/circuit-editor/{index.ts, domain/actions.ts, domain/reducer.ts, domain/history.ts, domain/to-netlist-source.ts, application/editor-store.ts}`
- Test: `src/features/circuit-editor/domain/{reducer,history,to-netlist-source}.test.ts`, `src/features/circuit-editor/application/editor-store.test.ts`

**Interfaces:**
- Consumes: `Project`, `Circuit`, `ChipInstance` from `~/features/projects`; `NetlistSource` from `~/features/simulation`; `ProjectRepository`, `PersistenceError` from `~/features/persistence`.
- Produces:
  - `type EditorAction = { type: "placeChip"; instance: ChipInstance } | { type: "moveChip"; instanceId: InstanceId; position: Point } | { type: "removeChip"; instanceId: InstanceId }`. Removing a chip also removes its wires.
  - `type EditorError = { type: "InstanceNotFound"; instanceId: InstanceId } | { type: "DuplicateInstance"; instanceId: InstanceId } | { type: "ProtectedInstance"; instanceId: InstanceId }`. In the slice, an instance whose built-in kind is `input` or `output` can't be removed.
  - `applyAction(project: Project, action: EditorAction): Result<Project, EditorError>` (pure and immutable)
  - `editorErrorMessage(e): string`
  - `type History<S> = { past: readonly S[]; present: S; future: readonly S[] }`, with `createHistory<S>(present: S): History<S>`, `pushHistory<S>(h, next: S, cap = 200): History<S>`, `undo<S>(h): History<S>` and `redo<S>(h): History<S>`. History uses snapshots (my call). Undo or redo past either end is a no-op.
  - `toNetlistSource(circuit: Circuit): Result<NetlistSource, { type: "UnsupportedPart"; instanceId: InstanceId }>`. Built-ins `input`, `nand` and `output` only in the slice; custom chips and the clock return `UnsupportedPart`.
  - `createEditorStore(project: Project, repo: ProjectRepository): EditorStore`, a Zustand vanilla store. State is `{ history: History<Project>; lastError: EditorError | PersistenceError | null; inputs: (0 | 1)[] }`. Actions are `dispatch(a: EditorAction): Result<void, EditorError>`, `undo()`, `redo()` and `setInput(i, v)`. After every change to `history.present`, it calls `repo.save` (debounced 300 ms, my call) and stores any error in `lastError`.

- [ ] **Step 1: Write failing tests:**
  - `placeChip` adds an instance;
  - a duplicate id → `DuplicateInstance`;
  - `moveChip` with an unknown id → `InstanceNotFound`;
  - `removeChip` drops attached wires;
  - removing a builtin `input` instance → `ProtectedInstance`;
  - history: push 3, undo 2, redo 1, so `present` equals the second state;
  - pushing after an undo clears `future`;
  - the cap of 200 keeps `past.length === 200`;
  - `toNetlistSource(createDemoProject("x").rootCircuit)` yields 2 inputs, 1 NAND and 1 output wired correctly;
  - the store calls `repo.save` once after 3 rapid dispatches (fake timers);
  - the store's `lastError` is set when `repo.save` returns `QuotaExceeded`, and editing continues.
- [ ] **Step 2: Run them.** Expected: FAIL. **Step 3:** Implement. **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5: Commit** `feat(editor): add typed actions, reducer, undo history and store`.

### Task 13: Canvas renderer, the accessible summary and the wired-up slice page

**Files:**
- Create: `src/features/circuit-editor/{adapters/canvas-renderer.ts, ui/CircuitCanvas.tsx, ui/CircuitCanvas.module.css, ui/EditorToolbar.tsx}`, `src/features/accessibility/{index.ts, ui/CircuitSummary.tsx, ui/CircuitSummary.module.css}`
- Modify: `src/routes/index.tsx`, `src/routes/projects.$projectId.tsx`, `src/routes/__root.tsx`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `createCanvasRenderer(canvas: HTMLCanvasElement, read: () => RenderState): { start(): void; stop(): void }`, where `RenderState = { circuit: Circuit; inputs: (0 | 1)[]; outputs: (0 | 1)[]; view: EditorSearch }`. It draws with `requestAnimationFrame` only when state changed or on resize. It reads colors with `getComputedStyle(document.documentElement).getPropertyValue("--color-…")` and re-reads them on a theme change. It handles `devicePixelRatio`.
  - `CircuitSummary`, a DOM view: a list of instances with translated labels. Inputs A and B are `Switch`es (`role="switch"`) that call `store.setInput`. The output shows "Output: 1/0" in an `aria-live="polite"` region.
  - Index route: lists saved projects. A "New project" button creates the demo, saves it and navigates to `/projects/<id>`. `requestPersistentStorage()` is called once on app start.
  - Project route:
    - loads the project via the repository, or shows the translated `NotFound` / `Corrupt` view;
    - creates the store and engine client, and sends `load` with `toNetlistSource` and `project.seed`;
    - on `setInput`, sends `setInput`, and `state` updates the outputs;
    - toolbar: Undo, Redo, Add NAND (dispatches `placeChip` at a free grid position), Export, Import (errors shown via `importErrorMessage`), ThemePicker, LanguagePicker.
  - On phones (< 640 px) the summary panel renders as a bottom area under a full-width canvas; on wider screens it's a side panel. Use CSS only for this; the bottom-sheet component comes later.

- [ ] **Step 1: Implement the renderer and the components.** React components never re-render per animation frame; the renderer reads the store through `store.getState()` and `subscribe`.
- [ ] **Step 2: Check the slice by hand.** Run `pnpm dev`, create a project, toggle A and B, and confirm all 4 combinations show the NAND truth table in both the canvas and the summary. Switch theme and language; Add NAND then Undo; export, then import the exported file.
- [ ] **Step 3: Run `pnpm check`.** Expected: PASS.
- [ ] **Step 4: Commit** `feat: wire canvas, accessible summary and slice page`.

### Task 14: PWA offline support

**Files:**
- Modify: `vite.config.ts` (`vite-plugin-pwa`: `registerType: "autoUpdate"`, `workbox.navigateFallback: "/_shell.html"`, precache all build assets, manifest with name, icons, `display: "standalone"`, theme colors from the dark theme)
- Create: `public/icons/*` (simple original icon)

- [ ] **Step 1: Configure it, then run `pnpm build && pnpm preview`.** Open DevTools → Application: the service worker is active and the manifest is valid.
- [ ] **Step 2: Commit** `feat: make the app an offline-capable PWA`. Task 15's offline E2E test proves it.

### Task 15: Playwright end-to-end tests, axe, keyboard, offline and visual

**Files:**
- Create: `playwright.config.ts`, `e2e/{slice,a11y,keyboard,offline,visual,import-export}.spec.ts`, `e2e/fixtures/{future-version.json,not-json.txt}`
- Modify: `package.json` scripts `e2e`, `e2e:visual`, `e2e:visual:docker`

**Interfaces:**
- Config:
  - `webServer`: `pnpm build && pnpm preview --port 4173`.
  - Projects: `chromium`, `firefox`, `webkit`, `mobile-chrome` (Pixel 7), `mobile-safari` (iPhone 15) and `tablet-safari` (iPad Pro 11).
  - `visual.spec.ts` runs only in `chromium` (`testIgnore` elsewhere).
  - `expect.toHaveScreenshot` uses `maxDiffPixelRatio: 0.01`.
- Scripts:
  - `e2e` = all projects, with `--grep-invert @visual`;
  - `e2e:visual` = `--project=chromium --grep @visual`;
  - `e2e:visual:docker` runs `e2e:visual` inside `mcr.microsoft.com/playwright:v<installed version>-noble`.

- [ ] **Step 1: Write the tests.**
  - `slice.spec.ts`: create a project and drive A/B through all 4 combinations. For each, expect `getByText(/Output: 1|Output: 0/)` to match the NAND truth table. Reload the page; the project is still there (IndexedDB).
  - `a11y.spec.ts`: run `AxeBuilder` with tags `wcag2a, wcag2aa, wcag21aa, wcag22aa` on the index and project pages, in every theme (set via the picker). Expect no violations.
  - `keyboard.spec.ts`: using only `page.keyboard` (Tab / Space / Enter), create a project, toggle both inputs and read the output change. Expect the focused element to have a visible focus ring, i.e. a computed `outline-style` other than `none`.
  - `offline.spec.ts`: load the app, wait for `navigator.serviceWorker.ready`, `context.setOffline(true)`, reload, and expect the heading to render.
  - `import-export.spec.ts`: export, then import the downloaded file, and the project matches. Importing `future-version.json` shows the translated FutureVersion message, and importing `not-json.txt` shows InvalidJson. In both cases the current project is unchanged.
  - `visual.spec.ts` (`@visual`): take a canvas screenshot of the demo project in light, dark and high-contrast, with A = 1 and B = 1.
  - In every spec, `page.emulateMedia({ reducedMotion: "reduce" })` is on by default. One test in `slice.spec.ts` checks that the computed `transition-duration` of a toolbar button is `0s` under reduced motion.
  - Language check: switch to Spanish in `slice.spec.ts` and expect the toolbar labels to change (e.g. the "Deshacer" button).
- [ ] **Step 2: Run `pnpm e2e`.** Expected: PASS in all projects. Run `pnpm e2e:visual:docker -- --update-snapshots` once to create the baselines in Linux, and commit them.
- [ ] **Step 3: Commit** `test(e2e): add flows, axe, keyboard, offline, import/export and visual tests`.

### Task 16: CI, branch protection, deploy examples and docs

**Files:**
- Create: `.github/workflows/ci.yml`, `deploy/README.md`, `deploy/nginx.conf`, `deploy/.htaccess`, `deploy/vercel.json`, `deploy/_redirects`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write `ci.yml`.** It runs on `push` and `pull_request`, with concurrency cancelling stale runs, using pnpm and Node from `.nvmrc` with cache.
  - Job `check`: `pnpm install --frozen-lockfile && pnpm check`.
  - Job `e2e`: in container `mcr.microsoft.com/playwright:v<ver>-noble`, `pnpm e2e`, uploading the report on failure.
  - Job `visual`: in the same container, `pnpm e2e:visual`.
- [ ] **Step 2: Add the deploy examples.** Each one rewrites unknown paths to `/_shell.html` with status 200 (nginx `try_files $uri $uri/ /_shell.html;`, Apache `FallbackResource /_shell.html`, Vercel `rewrites`, Cloudflare `_redirects` `/* /_shell.html 200`). `deploy/README.md` explains the requirement.
- [ ] **Step 3: Update `CLAUDE.md`.** Add a `## Commands` section listing `check`, `e2e`, `e2e:visual:docker` and `format`, and a `## Rules` section of 5–8 lines summarising the boundary and throw rules with ADR links.
- [ ] **Step 4: Push the branch, open a PR and wait for green CI.**
- [ ] **Step 5: Turn on branch protection** (the owner approved this, ADR 35):

```bash
gh api -X PUT repos/Garzafox/NAND_Computer_Architecture/branches/main/protection \
  -F required_status_checks[strict]=true \
  -f 'required_status_checks[contexts][]=check' -f 'required_status_checks[contexts][]=e2e' -f 'required_status_checks[contexts][]=visual' \
  -F enforce_admins=false -F required_pull_request_reviews=null -F restrictions=null
```

Expected: `gh api repos/Garzafox/NAND_Computer_Architecture/branches/main/protection --jq .required_status_checks.contexts` lists the 3 checks. Adjust the context names to match the actual job names shown on the PR.
- [ ] **Step 6: Commit** `ci: add CI workflow, deploy examples and docs`, then merge the PR.

---

## Notes on deviations from the spec

- Spec §7.2 says to prove each rule with a failing example and then remove it. This plan keeps the examples permanently as **lint canaries** (Task 3), checked by `pnpm lint:canaries` in `pnpm check`. That way a config change that silently disables a rule fails CI.
- Calls made in this plan (none of them were owner decisions):
  - snapshot-based undo;
  - 300 ms autosave debounce;
  - the mulberry32 random number generator, with `RACE_HOLD_PROBABILITY = 0.125`;
  - `runUntilStable(1000)` in the worker;
  - the UI layer at `src/shared/ui`;
  - the locale strategy (localStorage → browser language → `en`);
  - the 640 px phone breakpoint;
  - protecting builtin input/output instances from removal in the slice.
