# Strict template and foundations: design

Date: 2026-10-29. Status: draft, awaiting owner approval.

This document describes **what to set up first**: a strict, clean project template plus the architectural seams for a browser-based digital logic simulator. It is not the full product build. Decisions are recorded individually in `docs/adr/` (ADR numbers cited inline); terms are defined in `GLOSSARY.md`; supporting research is in `docs/research/`.

## 1. Intent and why

The owner wants an online, shareable digital logic simulator, inspired by Sebastian Lague's Digital-Logic-Sim (MIT, Unity/C#) and the Nand2Tetris course: you build every chip up from NAND gates. Lague's app must be downloaded; this one runs in a browser on phone, tablet and desktop, works offline, and can later be shared by link.

Before building features, the owner wants a **very strict template that prevents pitfalls**: the strictest practical TypeScript and lint rules, enforced folder boundaries, typed errors, validated data at every boundary, and automated tests, all enforced by machines (CI + hooks), not discipline.

The owner uses it first; later, other people try it and share their own projects.

## 2. Goals

1. A template where wrong code fails fast: type errors, lint errors, boundary violations, cycles, complexity, unhandled promises, untranslated strings and accessibility violations are caught locally (hooks) and in CI.
2. Architectural seams in place from day one so v1 features slot in without rework:
   - every edit is a typed **action** (ADR 8);
   - the simulation **engine** runs in a Web Worker behind a validated message protocol (ADR 12);
   - a **versioned save format** with migrations and fixtures (ADR 29);
   - **themes** as token data (ADR 10), **i18n** in en + es (ADR 17);
   - an owned **UI layer** over React Aria (ADR 26).
3. A thin vertical slice proving the seams work end to end (see §7).

### v1 product scope (built after the template, informs it)

- Canvas editor: place NAND gates, input pins, output pins, clock; wire them; toggle inputs; watch signals.
- Save a circuit as a **custom chip** with name and color; use it in other circuits; edits propagate; in-use chips can't be deleted (ADR 5).
- **Projects** contain chips; chip library with search, user folders and tags, recently used.
- Undo/redo (session only, ~200 steps, ADR 22).
- Play / pause / single-step / adjustable clock speed; seeded race resolution with "reroll seed" (ADR 15).
- JSON export/import of whole projects; IndexedDB autosave; export nudge (ADR 14).
- Phone, tablet, desktop; WCAG 2.2 AA; keyboard-only editing; screen-reader circuit view (ADRs 3, 13 answer, 21).
- Light, dark, high-contrast themes (ADR 10); en + es.
- Offline, installable PWA (ADR 7).

## 3. Non-goals and anti-goals

**Non-goals (not in v1, but don't block them):** share links (ADR 6, 16), Convex backend/sync/accounts, SVG export, auto-routing wires ("tidy up", ADR 9), multi-bit UI (format supports it, ADR 4), built-in fast chips like RAM (ADR 1), Lague save-file importer, theme library / user themes, MCP agent access (enabled by ADR 8), WASM/WebGPU engine (enabled by ADR 12), real-time collaboration (out of scope entirely).

**Anti-goals (failure even if it "works"):**
- A clone of Lague's app: copied code, assets, names or exact color values (ADR answer to Q2). Inspired-by look is fine: dark canvas, bold flat chips, lit wires.
- A canvas that's invisible to screen readers or unusable without a mouse or on a phone.
- Rules that are documented but not enforced.
- React re-rendering on every simulation tick or pointer move.
- A save file from v1 that a later version can't open.
- Tailwind or CSS-in-JS anywhere.
- Validation sprinkled through the simulation hot loop.

## 4. Constraints

- Closed source for now (no license file granting rights; "All rights reserved").
- The repo is owned by the `Garzafox` GitHub organization on an Enterprise plan, so branch protection and required status checks are available on this private repo. `main` is not protected yet; the owner approved enabling branch protection with required CI checks once the CI workflow exists (ADR 35). Actions minutes on private repos are metered, so the E2E browser matrix should be cached and kept lean.
- Hosts must serve `index.html` for unknown paths (SPA fallback). All candidate hosts support this; routes use real path segments. The template documents the requirement and ships example fallback config for nginx (Dokploy), Apache `.htaccess` (Hostinger), Vercel and Cloudflare _(design call)_. The PWA service worker uses the same navigation fallback.
- Static build, host-neutral, no deployment in the template (ADR 18). Likely hosts: Dokploy/Hostinger, later Vercel/Cloudflare.
- GitHub repo `Garzafox/NAND_Computer_Architecture`, issues on GitHub with triage labels (see `docs/agents/`).
- Supported browsers (ADR 34): last two versions of iOS/iPadOS Safari, Android Chrome, desktop Chrome, Edge, Firefox, Safari. Playwright projects: Chromium, WebKit, Firefox desktop, plus phone and tablet emulation in WebKit and Chromium. Canvas screenshot comparisons in Chromium only.
- The save format is a **draft** until the owner first shares a project externally; it can be reset freely until then, and the template ships only a minimal draft schema. At first share it freezes as version 1 and the migration/fixture rules apply (ADR 33). Folders and tags live in the project file; "recently used" is a per-device preference.
- `Digital-Logic-Sim.app` in the repo root is a local reference binary, git-ignored; never commit it.

## 5. Decided stack (as the owner decided it)

| Area | Decision | ADR |
|---|---|---|
| Package manager | pnpm, pinned via `packageManager`; strict pnpm catalogs | 30 |
| Runtime | Node current LTS, pinned (confirm version at setup) | 30 |
| Framework | TanStack Start, **SPA mode**, static output | 18 |
| Language | **TypeScript 7** only (native), every strict flag except `verbatimModuleSyntax` (TanStack Start advises against it) | 24 |
| Styling | Pure CSS + CSS Modules, typed class names; **no Tailwind, no CSS-in-JS** | 10, 24 |
| UI primitives | React Aria Components + React Aria hooks, wrapped in our own UI layer; Base UI Drawer as bottom-sheet fallback | 26 |
| Canvas | Raw Canvas 2D, render loop outside React | 20 |
| Editor state | Zustand store outside React, changed only by actions | 8, 25 |
| URL state | TanStack Router search params with Zod `validateSearch`; no extra URL-state lib | 16, 25 |
| Persistence | IndexedDB (via `idb`, see research), `navigator.storage.persist()` | 14, 25 |
| Validation | Zod 4 at trust boundaries only; `.brand()` for IDs | 11, 27 |
| Errors | Hand-rolled `Result`; discriminated error unions per feature; `throw` banned in engine/domain | 28 |
| i18n | Paraglide JS, en + es; missing keys are type errors (verify TanStack Start integration at setup) | 17, 19 |
| Lint | oxlint + tsgolint (type-aware) + JS plugins: sonarjs (cognitive complexity), eslint-plugin-boundaries, local ban-throw rule; `import/no-cycle` | 24 |
| Format | oxfmt (beta; fall back to Prettier if it causes trouble) | 24 |
| CSS lint | Stylelint with CSS Modules, ordering and a11y plugins | 24 |
| Other checks | knip, cspell (en + es), lefthook | 24 |
| Unit tests | Vitest (Node) for engine, actions, migrations, schemas; **95% branch coverage** on those | 32 |
| E2E | Playwright: user flows + axe on every screen + keyboard-only + screen-reader-view flows + canvas screenshot comparisons | 21, 32 |
| CI | GitHub Actions on push and PR: typecheck, lint (TS + CSS), format check, knip, cspell, unit + coverage, E2E | 13 |
| Commits | Conventional Commits via lefthook commit-msg; small PRs to `main` | 31 |
| PWA | Offline + installable | 7 |

Rejected alternatives and reasons are in the ADRs and research docs (ESLint/typescript-eslint blocked on TS 7; Biome typed rules still nursery; dependency-cruiser only TS 7 in beta; Mantine/Ark/Base UI/Radix vs React Aria).

## 6. Architecture

### 6.1 Folder structure (ADR 23)

```
src/
  features/
    simulation/      # engine + worker; pure TS, no React/DOM
    circuit-editor/  # canvas renderer, input handling, actions + reducer, undo
    chip-library/    # folders, tags, search, recently used
    projects/        # project CRUD, import/export, save format + migrations
    persistence/     # IndexedDB adapter
    sharing/         # URL encode/decode (later; folder may start empty or absent)
    theming/         # tokens, theme picker
    accessibility/   # screen-reader circuit view, keyboard editing helpers
  shared/            # Result, branded-id helpers, tiny utilities, UI layer (see below)
  routes/            # TanStack Start routes, thin
  i18n/              # Paraglide messages (en, es)
convex/              # later: convex/<aggregate>/{schema,queries,mutations}.ts
```

Inside each feature _(design call, not owner-decided)_:

```
features/<feature>/
  index.ts      # public API
  domain/       # pure logic: types, actions, reducers, schemas, migrations, errors. No throw, no I/O.
  application/  # orchestration of domain + adapters (use cases)
  adapters/     # I/O: IndexedDB, worker glue, browser APIs. May catch exceptions and convert them to Result.
  ui/           # React components and hooks for this feature
```

A feature only creates the subfolders it needs. `simulation` is pure throughout (no `ui/`, its worker entry is its only adapter). "Domain code" in the rules below means `simulation/**` (except its worker adapter) and every `features/*/domain/**`. The 95% branch-coverage threshold applies to the same globs plus `shared/` pure utilities.

Boundary rules (enforced by lint, not convention):
- Each feature exposes exactly one public `index.ts`; nothing imports another feature's internals.
- `simulation` imports nothing from React, the DOM or other features (only `shared` pure utilities).
- `shared` imports no feature.
- `routes` compose features via their public APIs only.
- Only the UI layer imports `react-aria-components` / `react-aria`.
- No import cycles anywhere.
- `throw` is banned in `simulation` and domain code of every feature.

### 6.2 Core concepts (see GLOSSARY.md)

- **Project** → many **custom chips**. Each chip has a **circuit**: placed chip instances, **pins**, **wires** (with grid-snapped right-angle waypoints, ADR 9). Pins and wires carry a **bit width** (ADR 4).
- Every entity has a stable, globally unique, **branded** ID (`crypto.randomUUID`); names are display-only (ADR 11).
- Custom chips are referenced by ID, never copied (ADR 5).

### 6.3 Actions and state (ADRs 8, 22, 25)

- A discriminated union `Action` describes every edit (place chip, move, connect wire, rename, recolor, create chip, delete...). One reducer applies actions to the project state and returns a `Result` (invalid actions, e.g. deleting an in-use chip, are typed errors).
- Zustand holds the open project; components subscribe via selectors only to what they show. The canvas reads the store directly, not through React.
- Undo/redo: session-only, capped ~200, built on actions (inverse actions or state snapshots: builder's call).
- After each applied action, persistence autosaves to IndexedDB (debounce is the builder's call).
- The URL holds location only: project ID, chip being edited, and optionally viewport and open panel.

### 6.4 Simulation engine (ADRs 1, 2, 12, 15)

- Runs in a Web Worker. Main thread ↔ worker messages are discriminated unions validated with Zod at the boundary.
- Engine compiles a project's circuit (flattening custom chips down to NANDs + built-in parts) into a flat, data-oriented netlist on typed arrays (struct-of-arrays), so it can later port to WASM or WebGPU.
- Tick-based: every NAND takes one tick. Races (simultaneous changes) resolve with a seeded PRNG; seed lives in the project. Same seed + same input sequence = same result.
- Oscillation detection/warning is desirable; exact algorithm is the builder's call.
- Built-in parts: NAND, input pin, output pin, clock. Displays later.
- SharedArrayBuffer is optional optimisation only (needs COOP/COEP headers); the template must not depend on it.

### 6.5 Rendering (ADRs 10, 20)

- Raw Canvas 2D, own render loop (requestAnimationFrame), outside React. React owns panels, menus, library, dialogs only.
- Renderer reads theme tokens (same tokens as CSS custom properties) so canvas and UI always match.
- Respect `prefers-reduced-motion`. Micro-interactions, chip gradients and animations are welcome within that.
- A renderer interface so a WebGL/WebGPU renderer could replace it later.

### 6.6 Input and accessibility (ADRs 3, 21, 26)

- Wiring: tap one pin then another (works for touch, mouse, keyboard), plus drag. Pinch zoom, two-finger pan, long-press context menu.
- Phone: bottom sheets over a full-screen canvas; desktop: side panels.
- A screen-reader circuit view (DOM, not canvas) lists chips, pins and connections and supports full keyboard editing through the same actions.
- WCAG 2.2 AA. Axe on every screen in E2E.

### 6.7 Data at the edges (ADRs 14, 27, 28, 29)

- Zod parses: file imports, IndexedDB reads, URL search params, share links (later), worker messages.
- Save format: `{ version: <int>, ... }` as a discriminated union on `version`, plus a chain of pure migrations to the current version. Every past version keeps a fixture file that tests load forever. Old schemas are never edited.
- Fallible operations return `Result<T, E>`; `E` is a feature's discriminated error union; every error case maps to an i18n message.
- On start, request persistent storage; nudge export when there is unexported work.
- Throw policy (ADR 36): banned in domain code; adapters may catch library exceptions and convert them to `Result`; elsewhere only for unreachable/bug cases. When Convex arrives, `convex/**` may throw only `new ConvexError(<typed error union>)` (that is what rolls back a mutation), and client adapters parse `error.data` with Zod back into the same union. Error unions are plain serialisable objects so they cross the wire unchanged. The template's lint config should already encode the `convex/**` rule so it holds when the folder appears.

### 6.8 Themes and i18n (ADRs 10, 17, 19)

- Theme = named set of design tokens (data). v1: light, dark, high-contrast. Picker designed so more themes plug in.
- All user-facing text through Paraglide; en + es; adding a language = adding one message file. React Aria's built-in strings cover es.

## 7. What "template done" means

The template is finished when:

1. All tooling in §5 is installed, configured at its strictest, and passing on a clean checkout, locally and in CI. _(Design call:)_ `pnpm check` runs everything except Playwright (fast, no Docker, used by hooks); `pnpm e2e` runs Playwright. Canvas screenshot baselines are generated and compared only in the pinned Linux Playwright container (CI, or locally via Docker on demand); non-screenshot E2E tests run natively on the Mac too.
   If an alpha oxlint JS plugin (sonarjs, boundaries, local ban-throw) proves unreliable, a weaker built-in substitute (e.g. per-folder `no-restricted-imports`, core `complexity`, `no-restricted-syntax` for `ThrowStatement`) is acceptable temporarily, with a GitHub issue tracking the gap _(design call)_.
2. Each enforcement is **proven** by a deliberately failing example the builder runs once (then removes): a cross-feature internal import, a cycle, a floating promise, a non-exhaustive switch, a `throw` in `simulation`, an over-complex function, a hard-coded user-facing string (if lint can catch it), an axe violation.
3. A thin vertical slice exists that exercises every seam:
   - a route with typed search params;
   - the UI layer with at least one React Aria-backed component and theme tokens (light/dark/high-contrast switch);
   - en/es switch via Paraglide;
   - a canvas that draws at least a NAND gate from store state;
   - one action through the reducer with undo;
   - the worker running a NAND with a toggleable input and showing the output;
   - a minimal draft save format (ADR 33) with Zod schema, the version/migration machinery wired up and tested with a dummy migration, one fixture and a round-trip export/import;
   - IndexedDB save/load;
   - PWA offline load;
   - a Vitest suite meeting the coverage threshold and a Playwright suite (flow + axe + screenshot).
4. `CLAUDE.md` documents the commands and the boundary rules briefly, pointing to ADRs.
5. `main` is protected with the CI checks required (ADR 35).

## 8. Left to the builder

- Exact package versions (use current stable at setup; research docs list Oct 2026 versions).
- Exact rule configuration beyond "strictest preset + the named rules"; thresholds for cyclomatic and cognitive complexity (sonarjs default 15 is a fine start).
- Whether the UI layer lives in `src/shared/ui` or a `design-system` feature.
- Undo implementation (inverse actions vs snapshots), autosave debounce, PRNG algorithm, oscillation detection.
- Worker message protocol details; netlist layout details.
- PWA tooling (e.g. `vite-plugin-pwa`) and React Compiler enablement (owner leaned yes; builder confirms compatibility).
- Visual design of the default themes (inspired-by, not copied).
- CI job layout and caching.

## 9. Known risks to spike early

- React Aria drag-and-drop from list to canvas on Android Chrome (RAC issue #6365).
- React Aria Sheet maturity on phones (fallback: Base UI Drawer).
- oxfmt beta stability; oxlint JS plugin (alpha) stability for sonarjs/boundaries.
- Paraglide + TanStack Start SPA integration.
- RAC typings vs `exactOptionalPropertyTypes` (absorb in UI layer).
