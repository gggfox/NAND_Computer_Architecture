# Strict template stack: research notes

Date: 2026-10-29. Scope: planning a browser digital-logic simulator inspired by Sebastian Lague's Digital-Logic-Sim. I used primary sources only: official docs, GitHub source, npm registry metadata and specs. Each version number is the npm `latest` dist-tag as of today, read from `registry.npmjs.org/<pkg>`. Items marked **[uncertain]** or **[analysis]** are my judgement, not something a source says.

## Recommendations at a glance

| Area | Recommendation | Confidence |
|---|---|---|
| Framework | TanStack Start **1.169.4** (1.0 stable since 2026-10-13), Vite **8.3.5**. Start in **SPA mode** (`spa.enabled`) so it deploys as static files. | High |
| CSS | Plain CSS plus Vite CSS Modules (`*.module.css`). No Tailwind. Load global CSS via `?url` and add it to the root route's `head` links. | High |
| TypeScript | Compile and typecheck with **TS 7.0.2** (`tsc`, native). Keep **TS 6.x aliased as `typescript`** for typescript-eslint. Turn on every strict flag below **except `verbatimModuleSyntax`**, which TanStack Start warns against. | High (the alias is officially documented) |
| Lint (primary) | ESLint **10.13** + typescript-eslint **8.72.1** `strictTypeChecked` + `stylisticTypeChecked`, plus explicit `strict-boolean-expressions` and `switch-exhaustiveness-check`. Add sonarjs **4.2.2** `cognitive-complexity`. | High |
| Lint (speed) | Consider **oxlint 1.90 + oxlint-tsgolint** as a fast pre-pass. It covers about 59/61 typed TS rules but has **no sonarjs cognitive-complexity** rule. Biome **2.6.4** typed rules are mostly *nursery*, so not yet. | Medium |
| Cycles and boundaries | **dependency-cruiser 18.7.0** in CI for cycles, orphans and feature boundaries (one tool). Optionally **eslint-plugin-boundaries 7.4.0** for in-editor feedback. Skip `import-x/no-cycle` (documented as expensive) and madge (last release 2024-08). | High |
| Errors | A **tiny hand-rolled `Result<T,E>`** in the domain/engine. Ban `throw` outside adapters with `no-restricted-syntax` and `only-throw-error`. Avoid `eslint-plugin-neverthrow`, whose last release was 2021. Effect **4.1** is viable but heavy for a template. | High |
| Validation | Zod **4.6.7**. Use `.brand<>()` for IDs. Model the save format as `z.discriminatedUnion("version", …)` plus a pure migration chain. Use `zod/mini` only if bundle size becomes critical. | High |
| E2E | Playwright **1.64.1**: a test-only `window.__sim` state hook read via `page.evaluate`, plus `toHaveScreenshot` (pinned environment), plus `toMatchAriaSnapshot` on the DOM chrome around the canvas. | High |
| Rendering | Canvas 2D with layered canvases and a rAF loop that lives outside React. Move to OffscreenCanvas in a worker later. Keep WebGL/WebGPU as a later swap. | Medium [analysis] |
| Sim engine | Struct-of-arrays on typed arrays, an engine-owned flat netlist, running in a Web Worker. SharedArrayBuffer only once COOP/COEP headers are guaranteed. | Medium [analysis] |
| Persistence | **idb 8.0.4** (~1.2 kB brotli) plus your own Zod-validated repository. Call `navigator.storage.persist()`. Use localStorage only for tiny prefs (5 MiB cap). | High |
| Share URL | Use `CompressionStream("deflate-raw")` + `Uint8Array.toBase64({alphabet:"base64url", omitPadding:true})` in the **fragment** (`#`). Fall back to a server-stored share (Convex) above roughly 8 KB. lz-string is unmaintained (2023). | High |
| Convex (later) | Nested folders under `convex/` per aggregate (`api.circuits.mutations.save`). Use a single `schema.ts` that spreads per-aggregate table defs. Keep logic in plain TS helpers. | High |

---

## 0. Sebastian Lague's Digital-Logic-Sim (reference project)

- **License: MIT** ([repo](https://github.com/SebLague/Digital-Logic-Sim)). It is a Unity/C# project (`Assets/`, `Packages/`, `ProjectSettings/`). The last commit on `main` is 2025-05-05, "Bump version 2.1.6" ([commits API](https://api.github.com/repos/SebLague/Digital-Logic-Sim/commits)). The README says PRs favour perf, UX and bug fixes over new features ([README](https://github.com/SebLague/Digital-Logic-Sim/blob/main/README.md)).
- **Save format (JSON via Newtonsoft):**
  - Each project folder holds `ProjectDescription.json` plus a `Chips/` folder ([SavePaths.cs](https://github.com/SebLague/Digital-Logic-Sim/blob/main/Assets/Scripts/SaveSystem/SavePaths.cs)).
  - `ProjectDescription` has `DLSVersion_LastSaved`, `DLSVersion_EarliestCompatible`, prefs, `AllCustomChipNames`, `StarredList` and `ChipCollections` ([ProjectDescription.cs](https://github.com/SebLague/Digital-Logic-Sim/blob/main/Assets/Scripts/Description/Types/ProjectDescription.cs)).
  - `ChipDescription` has `DLSVersion`, `Name`, `ChipType`, `Size`, `Colour`, `InputPins[]`, `OutputPins[]`, `SubChips[]`, `Wires[]` and `Displays[]` ([ChipDescription.cs](https://github.com/SebLague/Digital-Logic-Sim/blob/main/Assets/Scripts/Description/Types/ChipDescription.cs)).
  - A subchip is `{Name, ID (unique within parent, >0), Label, Position, OutputPinColourInfo[], InternalData: uint[]}`. `InternalData` holds ROM contents, bus links and key bindings ([SubChipDescription.cs](https://github.com/SebLague/Digital-Logic-Sim/blob/main/Assets/Scripts/Description/Types/SubTypes/SubChipDescription.cs)).
  - A wire is `{SourcePinAddress, TargetPinAddress, ConnectionType (ToPins | ToWireSource | ToWireTarget), ConnectedWireIndex, ConnectedWireSegmentIndex, Points[]}`. A pin address is `(PinOwnerID, PinID)`, which is **locally unique, not global** ([WireDescription.cs](https://github.com/SebLague/Digital-Logic-Sim/blob/main/Assets/Scripts/Description/Types/SubTypes/WireDescription.cs), [PinAddress.cs](https://github.com/SebLague/Digital-Logic-Sim/blob/main/Assets/Scripts/Description/Types/SubTypes/PinAddress.cs)).
  - Chips reference sub-chips **by name**, so this is a library of named definitions, not inlined copies.
- **Migrations:** `UpgradeHelper.ApplyVersionChanges` parses each chip's `DLSVersion` and applies ordered upgrade functions, e.g. `UpdateChipPre_2_1_5` remaps colour enum indices ([UpgradeHelper.cs](https://github.com/SebLague/Digital-Logic-Sim/blob/main/Assets/Scripts/SaveSystem/UpgradeHelper.cs)). This is the same "version field plus migrate chain" pattern recommended in section 6.
- **Pin state:** a `uint32`. The low 16 bits are bit values and the high 16 bits are tri-state ("disconnected") flags, so buses are at most 16 bits wide ([PinState.cs](https://github.com/SebLague/Digital-Logic-Sim/blob/main/Assets/Scripts/Simulation/PinState.cs)).
- **Simulation algorithm** ([Simulator.cs](https://github.com/SebLague/Digital-Logic-Sim/blob/main/Assets/Scripts/Simulation/Simulator.cs), from the code comments). It is a **readiness-driven ordering, not timed events**. Per step:
  1. Push inputs.
  2. Process any subchip whose input pins have all received values.
  3. Forward outputs.
  4. When nothing is ready (feedback loops), pick an unprocessed chip **at random**.

  Two more details:
  - **Traversal order is cached.** It is recomputed only after edits.
  - **Race-condition randomness:** every 100 frames, not-ready chips may be randomly swapped "to allow some variety in the outcomes of race-conditions (such as an SR latch…)".

  It runs on a **separate sim thread**. Edits are queued through a `ConcurrentQueue<SimModifyCommand>` and applied on the sim thread. Custom chips are simulated **hierarchically and recursively** (`BuildSimChipRecursive`), not flattened. The code lists TODO optimisations: LUTs for combinational chips, skipping chips whose inputs did not change, and flattening to builtin-only networks.

---

## 1. TanStack Start

- **Status:**
  - **1.0 stable**, announced 2026-10-13 ([blog](https://tanstack.com/blog/tanstack-start-1-0)). The docs overview says "TanStack Start is stable" ([overview](https://tanstack.com/start/latest/docs/framework/react/overview)).
  - npm `@tanstack/react-start` is **1.169.4**, published 2026-10-22. Its peer dep is **vite >=8.0.0** ([npm](https://registry.npmjs.org/@tanstack/react-start/latest)). Vite latest is **8.3.5**.
  - RSC support exists but is optional. Tanner says he stopped using RSC on tanstack.com because of the complexity ([blog](https://tanstack.com/blog/tanstack-start-1-0)).
- **SPA mode** ([guide](https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode)):
  - Enable it with `tanstackStart({ spa: { enabled: true } })`. Options are `maskPath` (default `/`) and `prerender` (default `outputPath: '/_shell.html'`).
  - The build emits one static shell. Deploy it to any CDN and rewrite 404s to `/_shell.html` with status 200.
  - Server functions and server routes still need a server. That is fine here: in a no-server template, simply don't use `createServerFn`.
- **Static prerendering** ([guide](https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering)):
  - Configure it with `prerender: { enabled, crawlLinks (default true), autoStaticPathsDiscovery, filter, pages, concurrency (14), failOnError (true), autoSubfolderIndex }`.
  - Output is static HTML per route. Use it for marketing/docs pages; the editor itself is client-only, so SPA mode fits.
- **Pure static deploy: yes, via SPA mode or prerender.** The hosting guide covers Cloudflare, Netlify, Railway, Vercel, Node/Docker, Bun and Appwrite, mostly through Nitro. It does not separately document plain static hosts ([hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)). **[analysis]** Any static host that supports SPA rewrites works with the `_shell.html` rewrite.
- **CSS without Tailwind:**
  - Start's docs only document Tailwind. Their Vite pattern still applies to any stylesheet: `import appCss from './styles.css?url'`, then add `{ rel: 'stylesheet', href: appCss }` to the root route's `head().links` ([styling guide](https://tanstack.com/start/latest/docs/framework/react/guide/tailwind-integration)).
  - Vite natively supports plain CSS and **CSS Modules** (`*.module.css`), with `css.modules.localsConvention` for camelCase named imports.
  - Lightning CSS minifies production CSS by default, and `css.transformer: 'lightningcss'` turns on full processing ([Vite CSS](https://vite.dev/guide/features.html#css-modules)).
  - **[uncertain]** Typed CSS-module class names need a plugin or a `.d.ts` generator. Vite does not provide them.
- **Project structure** ([build from scratch](https://tanstack.com/start/latest/docs/framework/react/build-from-scratch)):
  - `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/router.tsx`, generated `src/routeTree.gen.ts`, `vite.config.ts`.
  - **Plugin order:** `tanstackStart()` must come before `viteReact()`.
  - **Surprise:** the guide says to keep **`verbatimModuleSyntax` disabled** because it "can result in server bundles leaking into client bundles".
- **[analysis] Suggested layout for this app:** keep `src/routes/` thin. Put feature/domain code in `src/features/<feature>/` and the engine in `src/engine/`, a framework-free package with no React or DOM imports, so it can later move to a worker or WASM. Persistence adapters go in `src/infra/`.

## 2. Convex

- **Version:** `convex` **1.48.0** (2026-10-22).
- **Nested folders are supported.** The docs say "To structure your API you can nest directories inside the `convex/` directory". `convex/foo/myQueries.ts` → `api.foo.myQueries.listMessages`; the string form is `"foo/myQueries:listMessages"`. A default export maps to `.default` ([query functions](https://docs.convex.dev/functions/query-functions)).
- **Schema:** there must be **one `convex/schema.ts` default-exporting `defineSchema`** ([schemas](https://docs.convex.dev/database/schemas)). Because schema is config-as-code, you can define tables in other modules and spread them in. Convex staff recommend this on the official Discord Q&A ([thread](https://discord-questions.convex.dev/m/1137540909500735599)). **[uncertain]** The docs page itself shows only the single-file form.
- **Code-organisation guidance** ([best practices](https://docs.convex.dev/understanding/best-practices/)):
  - "Most of your code should live in a directory like `convex/model`" as plain TS helpers, with thin public `query`/`mutation`/`action` wrappers.
  - Use `internal.*` for server-only functions and argument validators on every public function.
  - Do access control via `ctx.auth`. There is a `@convex-dev/require-access-control` lint rule.
- **Limits** ([limits](https://docs.convex.dev/production/state/limits)):
  - 1 MiB per document, 16 MiB function args/returns, 230 MB code per deployment.
  - 32 indexes per table, 1,024 top-level fields, 8,192 array elements, value nesting depth 64.
  - Table, index and field names must not start with `_`.
  - **[analysis]** A large circuit with ROM data could approach 1 MiB. Store one chip definition per document rather than a whole project blob.
- **[analysis] DDD-aggregate layout:**
  ```
  convex/
    schema.ts                  // spreads ...circuitsTables, ...projectsTables
    circuits/{tables.ts, queries.ts, mutations.ts, model.ts}
    projects/{tables.ts, queries.ts, mutations.ts, model.ts}
    shares/{...}
    lib/{auth.ts, validators.ts}
  ```
  Calls then read `api.circuits.queries.byId`. Keep `_generated/` untouched.
- **TanStack Start integration:**
  - The official quickstart uses `convex` + `@convex-dev/react-query` + `@tanstack/react-query` + `@tanstack/react-router-ssr-query`, with `ConvexQueryClient` in `src/router.tsx` and `useSuspenseQuery(convexQuery(api.x.y, {}))`. The template is `npm create convex@latest -- -t tanstack-start` ([quickstart](https://docs.convex.dev/quickstart/tanstack-start), [guide](https://docs.convex.dev/client/tanstack/tanstack-start/)).
  - **Stale docs:** both Convex pages still say TanStack Start is "Release Candidate", which is out of date since 2026-10-13.

## 3. Strictest tsconfig and TypeScript 7

**TypeScript 7.0 (native Go port) is current.** npm `typescript@latest` = **7.0.2**. Details from the [7.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) (2026-07-08):

- **The binary is `tsc`.** Expect roughly 8–12x faster full builds.
- **Changed defaults:**
  - `strict: true`, `module: esnext`, `noUncheckedSideEffectImports: true`.
  - `types: []`; set it explicitly, e.g. `["vite/client"]`.
  - `rootDir: ./`.
- **Removed options:** `baseUrl`, `target: es5`, `moduleResolution: node/node10/classic`, `esModuleInterop: false`.
- **No programmatic API in 7.0.** For typescript-eslint, Microsoft documents running TS 6 side by side:
  ```json
  "@typescript/native": "npm:typescript@^7.0.2",
  "typescript": "npm:@typescript/typescript6@^6.0.2"
  ```
- **typescript-eslint is not compatible with TS 7.** typescript-eslint **8.72.1** peer-requires `typescript >=4.8.4 <6.1.0` ([npm](https://registry.npmjs.org/typescript-eslint/latest)).
- **TS 7.1 Beta** (2026-10-20) previews a new API (`typescript/sync`, `/async`, `/ast`, …). No stable date is given ([7.1 beta](https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/)). **[uncertain]** When typescript-eslint will support it is unknown.

**Flags beyond `strict`.** `strict` already includes `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `strictBuiltinIteratorReturn`, `noImplicitThis`, `useUnknownInCatchVariables` and `alwaysStrict` ([TSConfig reference](https://www.typescriptlang.org/tsconfig/)).

| Flag | Effect | Recommend |
|---|---|---|
| `noUncheckedIndexedAccess` | Index-signature and array reads get `\| undefined` | Yes. Essential for typed-array/netlist code |
| `exactOptionalPropertyTypes` | `x?: T` can't be assigned `undefined` unless the type says so | Yes. Pairs well with Zod `.optional()` semantics |
| `noPropertyAccessFromIndexSignature` | Forces `obj["k"]` for index-signature keys | Yes |
| `noImplicitOverride` | Requires `override` | Yes |
| `noImplicitReturns` | All code paths must return | Yes |
| `noFallthroughCasesInSwitch` | Non-empty cases must break/return/throw | Yes |
| `noUnusedLocals` / `noUnusedParameters` | Errors on unused names (`_` prefix exempt for params) | Yes, or leave to ESLint |
| `allowUnreachableCode: false` / `allowUnusedLabels: false` | Makes them errors instead of suggestions | Yes |
| `erasableSyntaxOnly` | Bans enums, runtime namespaces, parameter properties, `import =` and `<T>` casts, so code is type-strippable | Yes. Also helps a later WASM/AssemblyScript port **[analysis]** |
| `verbatimModuleSyntax` | Elides only `import type`. What you write is what's emitted | **No for TanStack Start** (bundle-leak warning above). Use `@typescript-eslint/consistent-type-imports` instead |
| `isolatedModules` | Flags constructs single-file transpilers (esbuild/Vite) can't handle | Yes |
| `isolatedDeclarations` | Requires explicit types on exports | Optional. Good for the `engine/` package boundary |
| `noUncheckedSideEffectImports` | Unresolvable side-effect imports error | Default `true` in TS 7. Note `import './x.css'` needs `vite/client` types |
| `forceConsistentCasingInFileNames` | Casing mismatch errors | Yes (default true) |

## 4. Linting

**Core: ESLint 10.13.0 + typescript-eslint 8.72.1** ([configs](https://typescript-eslint.io/users/configs/)).

- **Configs:**
  - `strictTypeChecked` is a superset of recommended, recommended-type-checked and strict. It is **not semver-stable**, so rules can change in minors.
  - `stylisticTypeChecked` is stable.
  - Use `parserOptions.projectService: true`.
- **Not in any preset; enable explicitly:**
  - [`strict-boolean-expressions`](https://typescript-eslint.io/rules/strict-boolean-expressions/). For maximum strictness set `allowString/allowNumber/allowNullableObject: false`.
  - [`switch-exhaustiveness-check`](https://typescript-eslint.io/rules/switch-exhaustiveness-check/). Set `considerDefaultExhaustiveForUnions: false` (default) and `allowDefaultCaseForExhaustiveSwitch: false`, so adding a union member always flags.
- `no-floating-promises` and `no-misused-promises` are in recommended-type-checked, so they are already in strict-type-checked. **[uncertain]** I did not re-fetch those rule pages.
- **Complexity:**
  - ESLint core [`complexity`](https://eslint.org/docs/latest/rules/complexity): cyclomatic, default `max: 20`, `variant: "classic" | "modified"` (modified counts a whole switch as +1).
  - `eslint-plugin-sonarjs` **4.2.2**: `cognitive-complexity` with default threshold **15** ([rule doc](https://github.com/SonarSource/eslint-plugin-sonarjs/blob/master/docs/rules/cognitive-complexity.md)). Peer: eslint ^8 \|\| ^9 \|\| ^10.
  - **Flag:** sonarjs is **LGPL-3.0-only** ([npm](https://registry.npmjs.org/eslint-plugin-sonarjs/latest)). That is fine as a dev tool, but note it for your license policy.

**Cycle detection:**

| Tool | Version / last release | Notes |
|---|---|---|
| `eslint-plugin-import-x` `no-cycle` | 4.17.1 | Docs: "comparatively computationally expensive". Mitigate with `maxDepth` and `ignoreExternal`. Ignores `import type` ([rule](https://github.com/un-ts/eslint-plugin-import-x/blob/master/docs/rules/no-cycle.md)) |
| dependency-cruiser | **18.7.0** (2026-10-19), Node ^22\|\|^24\|\|>=26 | Rule-based `forbidden` config. `--init` sets up circular and orphan rules. TS/TSX. Outputs err/dot/mermaid/json/html ([repo](https://github.com/sverweij/dependency-cruiser)) |
| madge | **8.0.0** (2024-08-05) | Circular detection plus Graphviz images. `detectiveOptions.ts.skipTypeImports`. Maintainer asks for funding ([repo](https://github.com/pahen/madge)). Stale |

**Boundaries:**

- `eslint-plugin-boundaries` **7.4.0** (2026-10-27) uses `boundaries/elements` (type + pattern) plus a `boundaries/dependencies` rule with default `disallow` and `from/allow/disallow` policies, in flat config ([repo](https://github.com/javierbrea/eslint-plugin-boundaries)). Its peer range is a loose `eslint >=6`.
- **[analysis]** dependency-cruiser can express the same "feature A may not import feature B internals" rules with path regexes, and it handles cycles too. Use it as the CI source of truth. Add boundaries only if you want red squiggles in the editor.

**Alternatives:**

- **oxlint 1.90.0 + oxlint-tsgolint 7.0.2005**:
  - Type-aware mode runs typescript-go and covers "59 of the 61" typed typescript-eslint rules. **Requires TS 7.0+-compatible tsconfig**, so no `baseUrl` ([type-aware](https://oxc.rs/docs/guide/usage/linter/type-aware.html)). The tsgolint README calls it stable and claims 10–20x faster than ESLint ([tsgolint](https://github.com/oxc-project/tsgolint)).
  - The rules list includes `no-floating-promises`, `no-misused-promises`, `only-throw-error`, `strict-boolean-expressions`, `switch-exhaustiveness-check`, `complexity` and `import/no-cycle`. There is **no sonarjs cognitive-complexity** and no boundaries plugin ([rules](https://oxc.rs/docs/guide/usage/linter/rules.html)).
  - **[uncertain]** I could not confirm the exact 2 missing typed rules.
  - Verdict: a realistic *pre-pass*, not yet a full replacement for this ruleset.
- **Biome 2.6.4**:
  - The `types` domain uses Biome's own inference engine.
  - `noFloatingPromises`, `noMisusedPromises`, `useStrictBooleanExpressions` and `useExhaustiveSwitchCases` are all **nursery**, "experimental and the behavior can change at any time" ([domains](https://biomejs.dev/linter/domains/), [noFloatingPromises](https://biomejs.dev/linter/rules/no-floating-promises/)).
  - Verdict: not realistic for a *strict* template yet.

## 5. Error handling

- **neverthrow 8.2.0:**
  - Last npm release was **2025-02-21**. Repo commits since then are docs-only, with the last on 2026-02-14 ([commits](https://api.github.com/repos/supermacro/neverthrow/commits)). It has 50 open issues and 33 open PRs ([repo](https://github.com/supermacro/neverthrow)).
  - It does offer `safeTry` with generators.
  - **Low maintenance.**
- **eslint-plugin-neverthrow 1.1.4: last release 2021-11-09.**
  - It depends on deprecated `tsutils@3.21.0`, and its peer is `@typescript-eslint/parser >=4.20` ([npm](https://registry.npmjs.org/eslint-plugin-neverthrow/latest)).
  - **[uncertain]** Whether it works under ESLint 10 flat config. Treat it as abandoned.
- **Effect 4.0** (2026-09-30), now **4.1.0** (2026-10-20/29) ([blog index](https://effect.website/blog)):
  - Zero-dep core, minimal program 7.1 kB min+gz (vs 35.6 kB in 3.x), lockstep versioning.
  - LTS with bug fixes to at least Sept 2029 ([4.0 post](https://effect.website/blog/releases/effect/40)).
  - **[analysis]** Powerful, but it is a paradigm. Too much for a "small strict template", though it is reasonable later for the Convex/IO edges.
- **Recommendation [analysis]:** a ~40-line `Result<T, E>` (discriminated union `{ ok: true, value } | { ok: false, error }`) with `E` as a discriminated union of domain errors. Enforce it with:
  - `@typescript-eslint/only-throw-error`. It is in recommended-type-checked, so it is already on, and it replaces core `no-throw-literal`, which you should turn off ([rule](https://typescript-eslint.io/rules/only-throw-error/)). Set `allowThrowingAny: false` and `allowThrowingUnknown: false` to tighten it.
  - `no-restricted-syntax` on `ThrowStatement` in `src/engine/**` and `src/features/**/domain/**`, to ban throw in the pure core.
  - `useUnknownInCatchVariables` (in `strict`) so `catch (e)` is `unknown`.
  - `@typescript-eslint/no-floating-promises` and `require-await`.
  - **[uncertain]** "must-use" on Result has no maintained lint rule. Approximations are `@typescript-eslint/no-unused-expressions`, plus making Result-returning functions the only API so discards are visible in review.

## 6. Zod v4: brands, size, versioned schemas

- **Version:** `zod` **4.6.7** (2026-10-12).
- **Brands** ([API docs](https://zod.dev/api#branded-types)):
  - `z.string().brand<"ChipId">()` infers `string & z.$brand<"ChipId">`. It is static-only, so `.parse` output is unchanged.
  - Since **4.2**, a second generic controls direction: `"out"` (default), `"in"` or `"inout"`.
  - **[analysis]** Use brands for `ChipId`, `PinId` and `WireId`. Use `"inout"` where branded IDs must also be required on input, e.g. internal APIs.
- **zod/mini** ([docs](https://zod.dev/packages/mini)):
  - Bundle size: `z.boolean().parse` is 2.12 kB vs 5.91 kB gz; a 3-field object is 4.0 kB vs 13.1 kB gz.
  - It has a functional API (`z.optional(z.string())`, `.check(z.minLength(5))`) and no English locale by default.
  - The docs recommend regular Zod unless size is strictly constrained. **[analysis]** For an app this size, use regular Zod.
- **Versioned save format [analysis, pattern mirrors Lague's UpgradeHelper]:**
  - `const SaveFileV1 = z.object({ version: z.literal(1), … })`, `SaveFileV2 = …`
  - `const AnySaveFile = z.discriminatedUnion("version", [SaveFileV1, SaveFileV2])`
  - `migrations: { 1: (v1) => v2, 2: (v2) => v3 }` are pure, total and unit-tested. `load()` parses `AnySaveFile`, then folds migrations up to `CURRENT`, then parses with `SaveFileCurrent`. It returns a `Result`.
  - Store `version` as an integer **format** version, separate from the app semver. Lague keeps both `LastSaved` and `EarliestCompatible`, which is useful for a "file is from a newer app" error.
  - Keep a `fixtures/v1.json`, `fixtures/v2.json` golden test per version.

## 7. Playwright E2E for a canvas app

- **Version:** `@playwright/test` **1.64.1**.
- **State hooks:** `page.evaluate()` runs code in the page and returns serialisable results. `page.addInitScript()` runs before page scripts, e.g. to seed `Math.random` or set a test flag. `page.exposeFunction()` bridges page→Node ([Page API](https://playwright.dev/docs/api/class-page)). **[analysis]** Expose a read-only `window.__sim` (netlist snapshot, pin states, camera) only when built with a test flag. Assert on *model state*, not pixels, for logic tests. Drive input with `page.mouse` at world→screen-converted coordinates taken from the same hook.
- **Visual:** `toHaveScreenshot` ([docs](https://playwright.dev/docs/test-snapshots)):
  - Baselines are per browser and platform (`chromium-darwin`). Use `threshold` (default 0.2) and `maxDiffPixels`, and `stylePath` to hide volatile UI.
  - Rendering "depends on OS, browser version, hardware, headless". Generate baselines in the same environment as CI. **[analysis]** Use the official Playwright Docker image.
  - Seed randomness. Lague's sim deliberately randomises race outcomes, so yours should take an injectable RNG seed.
- **Accessibility layer:** `toMatchAriaSnapshot` asserts the a11y tree as YAML ([docs](https://playwright.dev/docs/aria-snapshots)). **[analysis]** Mirror canvas selection and chip lists into DOM (an inspector panel or a visually-hidden list). That gives screen readers access and lets tests use `getByRole`.

## 8. Rendering

- **[analysis]** Canvas 2D handles thousands of wires and gates if you batch paths and redraw only on change. SVG creates a DOM node per wire, which costs layout and memory at scale but makes SVG *export* trivial: generate export SVG from the model, not the screen. WebGL/WebGPU suit very large circuits but cost a lot of complexity. WebGPU is **not Baseline** ("Limited availability"), secure-context only, and available in workers via `WorkerNavigator.gpu` ([MDN WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)).
- **MDN canvas guidance** ([Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)):
  - Use layered canvases: a static grid/background, the circuit, and an overlay for selection and drag.
  - Pre-render repeated primitives offscreen, batch calls (one path for many wire segments) and minimise state changes.
  - Use integer coords, `alpha:false` where possible, DPR scaling, `requestAnimationFrame`, and avoid `shadowBlur` and excessive text.
- **OffscreenCanvas:**
  - Baseline widely available since March 2023. `canvas.transferControlToOffscreen()` → `postMessage(..., [offscreen])`, and workers can use `requestAnimationFrame` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)).
  - **[analysis]** Pointer events still arrive on the main thread, so hit-testing needs a model copy or a round-trip. Start on the main thread with a renderer interface, then move it later.
- **Keeping React out of the hot loop [analysis]:** React owns only the chrome (toolbar, panels, dialogs). The canvas component mounts once, creates an imperative `Renderer`/`Editor` instance in a ref, and subscribes to a store via `useSyncExternalStore` only for UI-visible slices. The rAF loop reads the engine's typed arrays directly and pushes no state through React per frame.

## 9. Simulation engine portable to WASM/WebGPU

- **Lague's approach** (section 0) is readiness-ordered propagation with a cached order, random choice to break feedback loops, hierarchical recursion, and a separate thread.
- **Recommendation [analysis]:**
  - **Compile** the hierarchical chip library into a **flat netlist** of builtin primitives (NAND/AND/…/DFF/ROM/bus) at edit time. Lague lists flattening as a TODO.
  - Store it as **struct-of-arrays in typed arrays**: `gateType: Uint8Array`, `in0/in1: Uint32Array` (net indices), `out: Uint32Array`, and `netValue: Uint8Array` or bit-packed `Uint32Array`, plus a fanout CSR (`fanoutStart`, `fanoutList`). This layout maps 1:1 onto WASM linear memory and WebGPU storage buffers.
  - **Event-driven** (a worklist of nets that changed, then evaluate their fanout) suits sparse activity and works with feedback and latches. **Levelized** (topological order evaluated each tick) suits combinational DAGs and GPU parallelism but needs special handling for cycles. A pragmatic choice is event-driven with a per-tick iteration cap and oscillation detection, plus deterministic seeded tie-breaking.
  - Keep the engine API as `step(n)`, `setInput`, `readNets` over buffers, never objects. Write no closures or classes in the hot path, so the same algorithm ports to AssemblyScript/Rust or WGSL.
- **Worker:** run the engine in a dedicated Worker and post `ArrayBuffer`s as *transferables*. That works without isolation.
- **SharedArrayBuffer** needs a secure context and cross-origin isolation ([MDN SAB](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)):
  - `Cross-Origin-Opener-Policy: same-origin` plus `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless`). Check with `crossOriginIsolated` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated)).
  - **[analysis]** COEP can break third-party embeds and auth popups (COOP). Design so SAB is an optimisation behind a feature check, with postMessage snapshots as the fallback.

## 10. Persistence

| | idb | Dexie |
|---|---|---|
| Version | **8.0.4** (2026-10-06) | **4.4.7** (2026-10-19) |
| Size | "~1.19kB brotli'd" ([README](https://github.com/jakearchibald/idb)) | ~31 kB gzip (bundlephobia measurement, not a vendor claim) |
| License | ISC **[uncertain, not re-checked]** | Apache-2.0 ([repo](https://github.com/dexie/Dexie.js)) |
| Model | Promise wrapper mirroring IDB. Typed `DBSchema` generic. `upgrade(db, oldVersion, …)` for migrations. `tx.done` | Query builder, `version(n).stores()`, `useLiveQuery`, `EntityTable` typing. Dexie Cloud is a separate paid add-on |

- **[analysis]** idb fits the strict template. You validate with Zod at the repository boundary anyway, so Dexie's query layer adds little. Dexie wins if you want reactive live queries across tabs without writing them yourself.
- **Limits** ([MDN quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)):
  - **localStorage is 5 MiB per origin**, synchronous, and string-only. Use it for prefs only.
  - IndexedDB quotas: Chrome up to 60% of disk; Firefox best-effort is min(10% of disk, 10 GiB) per site group, and persistent is up to 50%; Safari 17+ about 60% for browser apps.
  - **Safari deletes script-written storage after 7 days without user interaction** when tracking prevention is on. That is a real risk for local-only saves, so offer export/backup and later Convex sync.
- **`navigator.storage.persist()`:** Firefox prompts. Chrome and Safari grant or deny silently based on engagement. Persistent origins are skipped in LRU eviction (same MDN page). Handle `QuotaExceededError`.

## 11. Share via URL

- **lz-string 1.5.0, last release 2023-03-04** (MIT) ([repo](https://github.com/pieroxy/lz-string)). It is ~1.5 kB gz and synchronous. Functionally fine but unmaintained.
- **Native approach (recommended):**
  - `new Blob([json]).stream().pipeThrough(new CompressionStream("deflate-raw"))`. CompressionStream has been Baseline since May 2023 and is available in workers.
  - The constructor now also lists `"brotli"` and `"zstd"` ([MDN ctor](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream/CompressionStream)). **[uncertain]** Per-browser support for those two is not confirmed, so use `deflate-raw` (no header or checksum, smallest).
  - Encode with `Uint8Array.prototype.toBase64({ alphabet: "base64url", omitPadding: true })`, Baseline 2025, since Sept 2025 ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/toBase64)). Decode with `Uint8Array.fromBase64`.
  - Prefix a format byte or version (e.g. `#v1.<payload>`) so URL payloads go through the same migration chain as section 6.
- **Length limits:**
  - RFC 9110: senders and recipients "SHOULD support … at a minimum, URIs with lengths of 8000 octets" ([RFC 9110 §4.1](https://www.rfc-editor.org/rfc/rfc9110#section-4.1)).
  - Chrome caps URLs at **2 MB** and the omnibox displays up to 32 kB ([Chromium URL guidelines](https://chromium.googlesource.com/chromium/src/+/main/docs/security/url_display_guidelines/url_display_guidelines.md)).
  - **[analysis]** Put the payload in the **fragment** (`#…`). It is never sent to servers or CDNs, which sidesteps server request-line limits and keeps circuits out of logs. Chat apps and link unfurlers may still truncate long links, so above roughly 8 KB fall back to "save to Convex, share short ID".

---

## Surprises and contested points

1. **typescript-eslint cannot run on TS 7.** Its peer range is `<6.1.0`. Microsoft's official answer is the `@typescript/typescript6` alias. oxlint's type-aware mode is the reverse: it *requires* a TS 7-compatible tsconfig.
2. **TanStack Start docs say to keep `verbatimModuleSyntax` off.** Most "strictest tsconfig" lists include it.
3. **`strict-boolean-expressions` and `switch-exhaustiveness-check` are in no typescript-eslint preset.** Enable them by hand. `strict-type-checked` is not semver-stable.
4. **eslint-plugin-neverthrow is abandoned** (2021), and neverthrow itself has had no release since Feb 2025.
5. **Convex's TanStack Start docs are stale.** They still say "RC" although Start 1.0 shipped on 2026-10-13.
6. **eslint-plugin-sonarjs is LGPL-3.0.**
7. **Lague's sim intentionally randomises race outcomes.** Its pin IDs are only locally unique and chips reference sub-chips by *name*. Decide early whether you want stable global IDs plus deterministic seeding (better for tests and URL sharing).
8. **Safari's 7-day storage eviction** makes local-only persistence fragile without export or a backend.
