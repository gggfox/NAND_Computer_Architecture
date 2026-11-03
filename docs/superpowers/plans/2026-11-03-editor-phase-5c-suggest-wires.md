# Editor Phase 5c: Suggest Wires Implementation Plan

## Status

Planned, waiting for the owner's approval. Nothing is built yet. The decisions marked **(beyond the spec)** need the owner's yes or veto before Task 1 starts. D13, the shortcut, needs it most.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Subagents follow the model policy in `CLAUDE.md`: implementers on `sonnet`, one `sonnet` review for the PR.

**Goal:** On request, the editor proposes wires into unconnected inputs and shows them as dashed ghost wires with a bar reading "Suggested wires: N · Accept all · Dismiss". Nothing changes in the circuit until the user accepts. Tapping a ghost (or `Enter` on it) accepts that one wire. Accept all adds the rest as one undo step. On a register file example the proposals are sensible, and ties are left alone. This completes issue #16.

**Architecture:**
- **Domain logic (pure, no React):**
  - `domain/suggest-names.ts` works out the name of each pin end, splits names into stem and number, and indexes the chip's sources by name, by stem and by width.
  - `domain/suggest-wires.ts` applies the three rules in order and returns the wires to propose, in reading order. It is one pass over the chip's inputs with index lookups, never a search over every input and output pair.
  - `domain/ghost-routes.ts` routes all the proposals at once over a draft circuit, using the same `settled` the real wires use, so ghosts are routed like real ones.
- **Interaction:** ghosts live only in `InteractionState.suggestions`. The commands are in a new `domain/interaction-suggest.ts`, registered with the wiring commands, because `interaction-commands.ts` is at its import limit (5b did the same). Accepting dispatches 5b's `connectWires`, so Accept all is one undo step. `afterHistory` drops the ghosts on any edit except the user's own accept.
- **UI:** a `SuggestionsBar` docked where the selection bar is, a **Suggest wires** button on the toolbar, an entry in the canvas menu (and in the library's quick-add, which replaces that menu), and a dashed ghost layer in the renderer.

**Tech Stack:** TypeScript 7, React 19 with the React Compiler, React Aria Components behind `src/shared/ui`, Zustand vanilla stores, Paraglide (en, es), Vitest, Playwright with axe.

**Spec:** `docs/superpowers/specs/2026-11-02-editor-phase-5-bulk-editing-design.md`, §1, §3.3, §5, §6 and §9. Builds on ADR 49 (`connectWires`, reading order), ADR 48 (the docked bar), ADR 43 (interaction state outside history) and ADR 44 (wiring, routing and colours).

**Base:** branch `claude/phase-5c-suggest-wires`, from `main` at 6b33381 (PR #31 merged).

## What the code has today (read on 6b33381)

- `domain/wire-edits.ts`: `connectWires` checks every wire against the circuit plus the wires before it, refuses the whole action on the first failure, refuses an empty list (`NothingToConnect`), and routes the new wires in one `settled` call. It is one history entry.
- `domain/bulk-wiring.ts`: `planBulkWires` and its `checkAll`, which drafts wires one by one with `checkConnection`. `domain/wiring-targets.ts` exports `sideWidth` (a pin's width as a wire sees it).
- `features/projects` `endpointInfo(project, circuit, instance, pin)` gives a pin's `role` (`source` or `sink`, where an input piece is a source) and `width`. `checkConnection` orients the ends and refuses `InputAlreadyDriven` per bit.
- `domain/chip-layout.ts`: built-in pins have fixed names: NAND `a`, `b`, `out`; the clock `out`; split and merge bits `0`, `1`, …. A layout pin's `label` includes the width (`d[4]`), so it is not the raw name. A pin piece is `kind: { type: "pin", pinId }`, named by the chip's pin definition.
- `domain/route-edits.ts`: `settled(scene, wireIds)` routes the listed wires and keeps unchanged objects. `domain/geometry.ts`: `wireRoute(scene, wire)` draws stored waypoints, or an elbow when there are none.
- `domain/pin-selection.ts`: `samePinOn` sorts by anchor, y then x then instance order ("reading order"). The comparator is inline, not exported.
- `domain/keymap.ts` (132 lines): `n`/`N` are `nextWire` (in `interaction-wire-keys.ts`), `Enter` is `connect` while `KeyContext.wiring`, else `openMenu`. `w` arms a pin. `W` (`Shift`+`w`) is unbound. `WITH_CTRL` maps lowercased keys to commands; `Ctrl`+`W` is not mapped.
- `domain/interact.ts` (59 lines, 5 modules) routes gestures to `onGesture`, commands to `onCommand`, and `historyChanged` to `afterHistory`. It clears `notice` on every input but hover.
- `domain/interaction-history.ts` (118 lines, 7 modules): `afterHistory` rebuilds the state after every edit, undo, redo or chip switch, keeping only what still exists. `application/interaction-store.ts` sends `historyChanged` synchronously from the editor's subscription, inside the `dispatch` effect, so the state the dispatching command just set is what `afterHistory` sees.
- `domain/interaction-tap.ts` (96 lines) imports 10 modules: no room. `hitTest` (in `hit-test.ts`, 290 lines) ranks pin > chip > label > wire, each within 12 screen px. `segmentDistance` there is private.
- `domain/selection-bar.ts`: `barVisible` shows the selection bar with chips or pins selected while nothing else has the canvas's attention. `ui/SelectionBar.tsx` docks it top centre (bottom on phones) and returns focus to the canvas host when it goes away.
- `ui/CanvasControls.tsx` `CanvasButtons`: the toolbar's Delete, wire colour, **Tidy wires**, zoom, fit and help. `ui/WireMenus.tsx` `CanvasMenuOverlay`: the default canvas menu has Tidy wires alone. `features/chip-library/ui/QuickAdd.tsx` replaces it through `CanvasMenuContext` (from `application/library-bridge.ts`), and offers Tidy wires as one of its picks.
- `domain/announcements.ts` is at 216 lines and dispatches pin texts to `announcements-pins.ts`.
- `src/features/projects/domain/e2e-fixtures.test.ts` (201 lines) generates `e2e/fixtures/*.json` from the builders.
- Line and import budgets: `interaction.ts` 281 lines and 10 modules; `interaction-commands.ts` 294 lines and 10 modules; `interaction-wiring.ts` 238 lines and 8 modules.

## Decisions made while planning (Claude's calls, open to the owner's veto)

- **D1. Where the wires can go.** A *sink* is a part's input or a circuit output piece. A *source* is a part's output or a circuit input piece (as `endpointInfo` sees them). A sink is **unconnected** when no wire reaches it, on any bit. Only unconnected sinks get proposals (spec §3.3.2). Sources may already fan out. A proposal never joins two pins of the same chip (spec, "never a chip wired to itself").
- **D2. Scope filters the result, not the search (beyond the spec).** Suggestions are always worked out over the whole chip. With chips selected, only the proposals with an end on a selected chip are kept. So "exactly one source" is judged on the whole chip, never on a filtered view, which would let the selection create a match that isn't really unique. With nothing selected, all are kept. Only `selection.instances` counts; selected wires and pins don't.
- **D3. Names come only from pins the user named (beyond the spec).** Rules 1 and 2 match the names of custom chip pins and pin pieces. Built-in parts (NAND `a`, `b`, `out`, the clock's `out`, split and merge bits `0`…`n`) take part only in rule 3. Otherwise an input piece called `a` would be proposed into every NAND's `a`, which is not a sensible connection.
- **D4. A candidate must be legal.** Each rule counts only sources whose wire would pass `checkConnection` against the circuit: the right width, the right direction, the sink free. A same-named output of the wrong width is not a candidate, so it doesn't cause a tie.
- **D5. Rule 1, same name.** A source whose name equals the sink's name, ignoring case. Exactly one legal candidate → proposed. Two or more → a tie: the sink falls through to rule 2.
- **D6. Rule 2, numbered series** (spec §8 leaves the split to the builder).
  - A name splits into a stem and a number when it ends in digits: `d0`, `d_0` and `D[0]` are all stem `d`, number 0. The stem must be non-empty, so a split's `0` is not a series. Stems compare ignoring case.
  - A **series** is two or more pins with the same stem and different numbers, either on one part or among the circuit's pin pieces of one direction (each piece is its own instance).
  - The sinks still unresolved after rule 1 are grouped into series. A sink series matches:
    - a **source series** on another chip with exactly the same numbers, pin k to pin k (`d0..d3` → `q0..q3`); or
    - **one source bus** whose width equals the series' size, when the numbers are exactly 0 to width − 1 and every sink is 1 bit: sink k takes bit k (`d0..d3` → bits 0–3 of a 4-bit `q`, issue #16).
  - **Two passes (beyond the spec).** First, only candidates whose stem (or a bus's name) equals the sink series' stem. If that gives exactly one, it is used. If it gives two or more, it's a tie and the series falls through to rule 3. Only if it gives none does the second pass consider every candidate, and again only exactly one is used. Preferring a matching name is the same principle as rule 1, not a guess. Without it, a register file's `d0..d3` would tie with every other register's `q0..q3` and the input bus, and nothing useful would be proposed.
  - A series is matched as a whole: if any member's pair is illegal, the candidate is out.
- **D7. Rule 3, only legal option.** Exactly one source on the whole chip, not on the sink's own chip, has the sink's width and passes `checkConnection`. Bits of a wider bus are not counted (otherwise every bus bit would be an "option" for a 1-bit input, and nothing would ever be unique). Ties and no candidates both leave the sink alone.
- **D8. Order.** Proposals are sorted by their sink's anchor in reading order (y, then x, then instance order, the 5b comparator, now exported from `pin-selection.ts`), then by bit. `n` steps through them in this order.
- **D9. Ghosts live in interaction state only** (spec §3.3.4). `InteractionState.suggestions?: Suggestions`, where
  `Suggestions = { ghosts: readonly Ghost[]; focus?: number; accepting?: readonly WireId[] }` and
  `Ghost = { from: PinRef; to: PinRef; route: readonly Point[] }`.
  The routes are computed once when suggesting: every ghost is added to a draft circuit and routed with one `settled` call, so ghosts from one source share a trunk, as real fan-out does. Routes are in world units, so panning and zooming never stale them, and every edit clears the ghosts anyway.
- **D10. Accepting** (spec §3.3.3, §3.3.4).
  - **Tap a ghost, or `Enter` on the focused one:** one `connectWires` with that one wire (one undo step), in `state.wireColor`. The other ghosts stay. The spec's "Accept all adds every remaining ghost" implies this.
  - **Accept all:** one `connectWires` with every remaining ghost. The bar goes.
  - **Dismiss**, or `Escape`: the ghosts go, nothing is dispatched.
  - **Any other change clears them**: any edit, undo, redo, or switching chips. `afterHistory` keeps the ghosts only when the change is the accept itself: the accept stores the new wires' ids in `accepting`, and `afterHistory` keeps the rest only if every one of those ids is now in the circuit, then drops `accepting`. A refused `connectWires` leaves history alone, so `accepting` stays stale and the next edit (whose ids don't match) clears the ghosts. Undoing an accept is an edit, so it clears them.
  - The ghosts that remain after an accept are re-checked with `checkConnection`. Any that would now be illegal are dropped. (None should be, since each ghost has its own sink or bit, but `connectWires` never trusts a plan, and neither does this.)
- **D11. Tapping.** A pin still beats a ghost, so tapping a ghost's end pin works as today. A ghost beats a chip body, a name and a wire, since ghosts are drawn on top. A ghost's reach is 12 screen px, like a wire's. The ghost tap goes through `interact.ts`, before `onGesture`, because `interaction-tap.ts` has no import room.
- **D12. Keyboard** (spec §3.3.3). While ghosts show, `n`/`N` step through them instead of through wires. Each step focuses the ghost, brings it into view if it is off screen (as `]` does for chips), and announces its ends. `Enter` accepts the focused ghost. Focus then stays on the same index, so the next ghost is focused and repeated `Enter` accepts them in order. With no ghost focused, `Enter` keeps its usual meaning. `Escape` clears, in order: the bit picker, a menu, a placement, the armed pin, the pin list and Pick pins, **then the ghosts**, then the card, then the chip selection. `KeyContext` gains `ghosts` and `ghostFocused`.
- **D13. The shortcut (beyond the spec, needs the owner).** The spec asks for `Ctrl`/`⌘`+`Shift`+`W`. Chrome and Edge reserve that combination: it closes the browser window, and pages are never sent the key, on Windows, Linux and macOS. Firefox closes the window too. So the shortcut can't work in a tab, and a user who tries it loses the window. **Proposal: `Shift`+`W`** ("W" for wire, next to `w` for arm). It is free today, and it is a plain canvas key like the others, so it works only while the canvas has focus. The toolbar button and canvas menu stay the discoverable paths.
- **D14. The suggestions bar.** `SuggestionsBar` docks where the selection bar does (top centre, bottom on phones). It reads "Suggested wires: {count}", then **Accept all** and **Dismiss** buttons. While ghosts show, the selection bar hides (`barVisible` gains `suggestions === undefined`), so the two never overlap. The refusal notice already sits below a docked bar on wide screens. When the bar goes away while it had focus, focus returns to the canvas host, as the selection bar does.
- **D15. Running Suggest wires** closes menus and the card, disarms a pin, stops a placement, and keeps the selection (it is the scope). Running it again while ghosts show replaces them. With nothing to propose it announces "No wires to suggest", and no bar appears.
- **D16. Announcements**, in `en` and `es`, in the project's "Label: {count}" form, which avoids plural rules:
  - "Wires suggested: {count}" (spec: "8 wires suggested"), and the bar's own label "Suggested wires: {count}";
  - "Wires accepted: {count}" (spec: "Accepted 8 wires"), for one ghost and for Accept all;
  - "No wires to suggest";
  - "Suggestions dismissed";
  - when `n` focuses a ghost: "Suggested wire {index} of {count}: {from} on {fromChip} to {to} on {toChip}", using `pinInfo` names and `chipLabel`, with `.k` for a bit as the pin card does.
- **D17. Drawing** (spec §8 leaves the style to the builder). Ghosts are drawn dashed, on the overlay layer, in the colour a new wire would get (`state.wireColor`, else the default wire token), at reduced opacity. The opacity is the lowest that still gives 3:1 against the canvas in every theme (WCAG 1.4.11), checked by a unit test with the token data. The focused ghost also gets the focus-ring halo selected wires get. Ghost routes are clipped to the visible world, like real wires.
- **D18. The canvas menu.** `CanvasMenuContext` gains `suggestWires`. The default canvas menu gets a **Suggest wires** entry after Tidy wires, and the library's quick-add gets a **Suggest wires** pick beside its Tidy wires pick, since quick-add replaces the default menu.
- **D19. Not in this PR:** a series of 1-bit *sources* into the bits of an unconnected *sink* bus (`q0..q3` → bits of a 4-bit output piece). The spec names only the other direction. It is a follow-up.

## Global Constraints

- Feature folders expose only `index.ts`, and there are no import cycles (ADR 23). `suggest-names.ts`, `suggest-wires.ts` and `ghost-routes.ts` don't import `interaction.ts`. `interaction-suggest.ts` doesn't import `interaction-wiring.ts`.
- No `throw` in `domain/`; return `Result` where something can fail (ADR 28). Zod only at trust boundaries (ADR 27).
- Only `src/shared/ui` imports `react-aria-components` or `react-aria` (ADR 26).
- Every user-facing string goes through Paraglide in both `messages/en.json` and `messages/es.json` (ADR 17).
- Lint limits: ≤ 300 lines per file, ≤ 50 lines per function, ≤ 3 parameters, complexity ≤ 10, ≤ 10 imported modules per file.
  - `interaction.ts` (281 lines, 10 modules) gets **no new imports**. The new types live in `domain/suggestion-types.ts` and reach it through `selection.ts`, which re-exports them, as 5b's types do from `pin-selection.ts`. Budget: ≤ 8 new lines.
  - `interaction-commands.ts` (294 lines, 10 modules) is **not touched**. The commands are spread into `WIRING_COMMANDS`, and Escape's ghost step goes in `cancelWiring`.
  - `interaction-tap.ts` (10 modules) is **not touched**. The ghost tap is handled in `interact.ts` (5 modules).
  - `hit-test.ts` is at 290 lines. `distance` and `segmentDistance` move to `geometry.ts` (179 lines) and are exported from there, which frees lines.
  - New announcement texts go in `announcements-suggest.ts`; `announcements.ts` only dispatches.
- Every `domain/**` file needs ≥ 95 % branch coverage.
- Touch targets ≥ 24 px. Axe passes in every theme with the suggestions bar showing and a ghost focused.
- **Never applied without confirmation** (spec §5): no code path dispatches an edit when suggesting, focusing, dismissing, or on `historyChanged`. Only the accept paths dispatch.
- Suggest wires on a 200-part chip, matching plus ghost routing, stays within one 16 ms frame (median of 7, without coverage; measured in Task 0, pinned in Task 3). `pnpm e2e:perf` p95 stays ≤ 20 ms.
- Visual baselines are regenerated only with `pnpm e2e:visual:docker --update-snapshots=all`. Never commit macOS baselines.
- Commit messages follow Conventional Commits (commitlint) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Don't bypass hooks.

## Review Focus

1. **Nothing is applied without confirmation.** Suggesting, cycling, dismissing and `historyChanged` never emit a `dispatch`. Pinned by Task 4 (each command's effects) and Task 7 (the export shows no wires until Accept).
2. **Never guess.** Ties at every rule fall through, and an input no rule settles is left alone. No proposal joins a chip to itself. Pinned by Task 2's tie tests and Task 7's `load` pins.
3. **One undo step.** Accept all is one `connectWires`; one Undo removes every accepted wire. Accepting one ghost is one step too. Pinned by Task 4 and Task 7.
4. **Stale ghosts can't be accepted.** Any edit other than the accept clears them; undo and redo clear them; the remaining ghosts after an accept are re-checked. Pinned by Task 4's history tests and Task 7.
5. **Nothing else changes behaviour.** With no ghosts showing, `n`/`N`, `Enter`, `Escape` and taps behave exactly as on `main`. Pinned by the existing keymap, wiring and tap tests, unchanged.
6. **Frame budget on a 200-part chip.** Pinned by Task 0 and Task 3.

---

## File Structure

```text
src/features/circuit-editor/
  domain/geometry.ts                  # + distance, segmentDistance (moved from hit-test.ts)
  domain/hit-test.ts                  # imports them back
  domain/pin-selection.ts             # + readingOrder comparator, exported (D8)
  domain/suggestion-types.ts          # NEW Ghost, Suggestions, SuggestCommand, SuggestAnnouncement
  domain/selection.ts                 # re-exports the suggestion types
  domain/suggest-names.ts             # NEW pin names, stem split, source index (D3, D6)
  domain/suggest-wires.ts             # NEW the three rules (D1–D8)
  domain/ghost-routes.ts              # NEW route every proposal at once (D9)
  domain/interaction.ts               # + suggestions, SuggestCommand, SuggestAnnouncement
  domain/interaction-suggest.ts       # NEW commands, ghost tap, history step (D10–D15)
  domain/interaction-wiring.ts        # spreads SUGGEST_COMMANDS; Escape's ghost step
  domain/interact.ts                  # ghost tap before onGesture
  domain/interaction-history.ts       # keeps or drops the ghosts (D10)
  domain/keymap.ts                    # Shift+W, n/N and Enter with ghosts (D12, D13)
  domain/selection-bar.ts             # hides while ghosts show; suggestionsBarVisible
  domain/announcements-suggest.ts     # NEW texts (D16)
  domain/announcements.ts             # dispatches to announcements-suggest
  ui/use-canvas.ts                    # KeyContext.ghosts, ghostFocused
  ui/ghosts-of.ts                     # NEW ghosts for the render state
  ui/render-state-of.ts               # + ghosts
  adapters/draw-ghosts.ts             # NEW dashed ghost wires (D17)
  adapters/draw-overlays.ts           # calls drawGhosts; OverlayView gains ghosts
  ui/SuggestionsBar.tsx               # NEW (+ .module.css, sharing SelectionBar's dock styles)
  ui/ModeOverlays.tsx                 # renders SuggestionsBar
  ui/CanvasControls.tsx               # + Suggest wires button
  ui/WireMenus.tsx                    # + Suggest wires in the canvas menu
  application/library-bridge.ts       # CanvasMenuContext.suggestWires
  ui/KeyboardHelp.tsx                 # + Shift+W, n/N, Enter, Escape with ghosts
src/features/chip-library/ui/QuickAdd.tsx, quick-add-view.ts   # + Suggest wires pick
src/features/projects/domain/e2e-fixtures.test.ts             # + register-file.json
messages/en.json, messages/es.json
e2e/fixtures/register-file.json       # NEW (generated)
e2e/suggest-wires.spec.ts             # NEW
e2e/a11y-suggest.spec.ts              # NEW
```

---

### Task 0: Spike: Suggest wires on a 200-part chip (judgement)

Spec §9. It runs first, so a slow result changes the plan before any UI exists. The code is throwaway; only the numbers are kept.

- [ ] **Step 1:** In a throwaway Vitest file (not committed), build a 200-part chip with the builders: 40 instances of a saved custom `Reg` chip (inputs `d0`…`d3`, `load`, `clk`; outputs `q0`…`q3`), 150 NANDs, a 4-bit input piece `d`, a 1-bit input piece `clk`, and 8 more pin pieces. Wire a third of the NAND inputs, so the rest are unconnected.
- [ ] **Step 2:** Time three things, median of 7 runs each, without coverage:
  - **Naive matching:** for every unconnected sink, `checkConnection` against every source. This is the cost spec §9 worries about.
  - **Indexed matching:** a sketch of D5–D7 with sources indexed by lowercased name, by stem and by width, calling `checkConnection` only for the candidates the index returns.
  - **Ghost routing:** the expected 200 proposals (40 `clk` and 160 bits of `d`) added to a draft and routed with one `settled`.
- [ ] **Step 3:** Record the three numbers in this plan's Status, and decide:
  - Indexed matching plus routing under 16 ms: go on as planned.
  - Matching over budget: stop and report; the likely fix is a lookup for "is this sink driven" built once, instead of `checkConnection`'s scan per call.
  - Routing over budget: draw ghosts as elbows (`waypoints: []`, which `wireRoute` already draws as an elbow) and route only on accept. That changes D9's "routed like real ones", so report it to the owner first.

### Task 1: Pin names and series (judgement)

**Files:**
- Create: `domain/suggest-names.ts` and `suggest-names.test.ts`

**Interfaces:**
- Produces:
  ```ts
  /** A pin end as the rules see it (D1, D3). `name` is set only for a named pin (custom chip or pin piece). */
  export interface End {
    readonly ref: PinRef;
    readonly role: "source" | "sink";
    readonly width: number;
    readonly name?: string;
  }
  /** `d0`, `d_0`, `D[0]` → { stem: "d", index: 0 }; `undefined` without a non-empty stem and a number (D6). */
  export const splitName: (name: string) => { readonly stem: string; readonly index: number } | undefined;
  /** Every pin end of the circuit, with sinks marked unconnected or not. */
  export const endsOf: (scene: Scene) => { readonly sources: readonly End[]; readonly sinks: readonly End[] };
  /** Sources by lowercased name, by lowercased stem (grouped into series per chip, or per piece direction), and by width. */
  export interface SourceIndex { /* byName, seriesByStem, allSeries, byWidth */ }
  export const indexSources: (sources: readonly End[]) => SourceIndex;
  ```

- [ ] **Step 1: Write the failing tests:**
  - `splitName`: `d0` → (`d`, 0), `d_12` → (`d`, 12), `D[3]` → (`D`, 3), `clk` → undefined, `0` → undefined, `d[` → undefined, `a1b2` → (`a1b`, 2).
  - `endsOf`: a NAND's pins have no `name` (D3); a custom chip's pins have their definition names; an input piece is a source and an output piece a sink, both named; a sink with a wire on any bit is not unconnected; a 4-bit input has width 4.
  - `indexSources`: two sources named `CLK` and `clk` share one name entry; `q0..q3` on one chip form one series, and `q0..q3` on another chip a second one; input pieces `d0..d3` form one series together; a lone `q0` is not a series.
- [ ] **Step 2:** Run `pnpm vitest run src/features/circuit-editor/domain/suggest-names.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement. Names come from the project's pin definitions (custom chips: the saved version's pins; pieces: the open chip's pin for `pinId`). Use `endpointInfo` for role and `sideWidth` for width.
- [ ] **Step 4:** Run the test again with coverage (`pnpm vitest run --coverage src/features/circuit-editor/domain/suggest-names.test.ts`): ≥ 95 % branches. Run `pnpm typecheck`.
- [ ] **Step 5: Commit:** `feat(circuit-editor): name pins and series for suggested wires`.

### Task 2: The matching rules (judgement)

**Files:**
- Create: `domain/suggest-wires.ts` and `suggest-wires.test.ts`
- Modify: `domain/pin-selection.ts` (export the reading-order comparator, D8, and use it in `samePinOn`)

**Interfaces:**
- Produces:
  ```ts
  export interface Proposal { readonly from: PinRef; readonly to: PinRef }
  /**
   * Wires into unconnected inputs by the three rules in order (D1–D8), in reading order of their sinks.
   * With `scope`, only proposals with an end on one of those chips (D2). Never changes the scene.
   */
  export const suggestWires: (scene: Scene, scope?: ReadonlySet<InstanceId>) => readonly Proposal[];
  ```

- [ ] **Step 1: Write the failing tests**, one block per rule and one for ties:
  - **Rule 1:** an input piece `clk` and four `Reg` parts: four proposals into each `clk`. `CLK` matches `clk`. A same-named source of the wrong width is ignored (D4), so a 1-bit `q` and a 4-bit `q` don't tie for a 1-bit sink.
  - **Rule 1 tie:** two sources named `clk`: no rule-1 proposal; the sink falls through, and with other 1-bit sources around, gets nothing.
  - **Rule 2, series to series:** `A.q0..q3` → `B.d0..d3`, index by index, when they are the only series with those numbers.
  - **Rule 2, series to bus:** a 4-bit input piece `d` and a `Reg`'s `d0..d3` give `from` bits 0–3 of `d`, sink k to bit k. A 3-bit bus doesn't match 4 sinks. `d1..d4` doesn't match (numbers aren't 0…3).
  - **Rule 2, passes (D6):** with a 4-bit `d` and two other `Reg`s' `q0..q3` around, the first pass picks `d` (matching stem). With two 4-bit sources both named `d`, the first pass ties and the series falls through to rule 3 (and gets nothing). With no matching stem and exactly one candidate series, the second pass picks it.
  - **Rule 3:** a lone 2-bit output and an unconnected 2-bit input on another chip: one proposal. Add a second 2-bit output: none. A bus's bits are never counted for a 1-bit sink.
  - **Never a chip to itself:** a `Reg` whose own `q0..q3` would be the only series for its `d0..d3` gets no proposal.
  - **Only unconnected sinks:** a sink with a wire, or with one bit of a bus wired, gets nothing.
  - **Built-ins (D3):** an input piece `a` and three NANDs: no proposal into any NAND's `a` by name.
  - **Scope (D2):** with one `Reg` selected, only its 5 proposals of the 20 in the register file come back, and a sink outside the selection that is unique only within the selection gets nothing.
  - **The register file (the e2e fixture's chip):** exactly 20 proposals: 4 `clk`, 16 bits of `d`. No `load` pin gets one (Review Focus 2).
  - **Order:** proposals follow the sinks' reading order, then bit.
  - The scene is unchanged (compare before and after).
- [ ] **Step 2:** Run `pnpm vitest run src/features/circuit-editor/domain/suggest-wires.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement as small functions, each ≤ 50 lines and complexity ≤ 10: `byName`, `bySeries` (with the two passes), `byOnlyOption`, and `suggestWires` that runs them in order over the sinks left unresolved by the rule before. Check a candidate's legality with `checkConnection` only after the index narrows it.
- [ ] **Step 4:** Run the test with coverage (≥ 95 % branches), `pnpm vitest run src/features/circuit-editor/domain/pin-selection.test.ts` (unchanged), and `pnpm typecheck`.
- [ ] **Step 5: Commit:** `feat(circuit-editor): propose wires by name, series or the only legal option`.

### Task 3: Ghost routes and the timing guard (judgement)

**Files:**
- Create: `domain/suggestion-types.ts`, `domain/ghost-routes.ts` and `ghost-routes.test.ts`
- Modify: `domain/selection.ts` (re-export the suggestion types)

**Interfaces:**
- Produces:
  ```ts
  // suggestion-types.ts: no import of interaction.ts
  export interface Ghost { readonly from: PinRef; readonly to: PinRef; readonly route: readonly Point[] }
  export interface Suggestions {
    readonly ghosts: readonly Ghost[];
    /** The ghost `n` focused, by index; `Enter` accepts it. */
    readonly focus?: number;
    /** The wires the last accept dispatched; the history step keeps the ghosts only for them (D10). */
    readonly accepting?: readonly WireId[];
  }
  export type SuggestCommand =
    | { readonly type: "suggestWires" | "acceptAllGhosts" | "dismissGhosts" }
    | { readonly type: "acceptGhost"; readonly index?: number }   // no index: the focused one
    | { readonly type: "nextGhost"; readonly backwards: boolean };
  export type SuggestAnnouncement =
    | { readonly type: "suggested"; readonly count: number }      // 0: "No wires to suggest"
    | { readonly type: "accepted"; readonly count: number }
    | { readonly type: "dismissed" }
    | { readonly type: "ghostFocused"; readonly index: number; readonly count: number; readonly ghost: Ghost };
  // ghost-routes.ts
  /** Each proposal with the route a real wire would take, all routed at once over a draft (D9). */
  export const ghostsOf: (scene: Scene, proposals: readonly Proposal[]) => readonly Ghost[];
  ```

- [ ] **Step 1: Write the failing tests:**
  - Each ghost's route starts at its `from` anchor and ends at its `to` anchor, and doesn't enter a chip body other than its ends' (use `entersChips` from `routing.fixtures.ts`).
  - Two ghosts from one source share their first segment, as fan-out wires do.
  - The scene's circuit is the same object afterwards.
  - **Timing guard:** on Task 0's 200-part chip, `ghostsOf(scene, suggestWires(scene))` takes under 16 ms (median of 7) without coverage. Under coverage it asserts a looser bound, as 5b's `connectWires` test does (record the factor). Record the numbers in Status.
- [ ] **Step 2:** Run `pnpm vitest run src/features/circuit-editor/domain/ghost-routes.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement: orient each proposal with `checkConnection` against the draft so far, add it with a placeholder id (`ghost:<n>`, never dispatched), call `settled` once with all of them, and read each route back with `wireRoute`.
- [ ] **Step 4:** Run the test and `pnpm typecheck`. Expect PASS.
- [ ] **Step 5: Commit:** `feat(circuit-editor): route suggested wires like real ones`.

### Task 4: Suggestion commands, taps, keys and history (judgement)

**Files:**
- Create: `domain/interaction-suggest.ts` and `interaction-suggest.test.ts`
- Create: `domain/announcements-suggest.ts` and its test. Modify `domain/announcements.ts` (dispatch only)
- Modify: `domain/interaction.ts` (≤ 8 lines, no new imports), `domain/interaction-wiring.ts` (spread and Escape step), `domain/interact.ts` (ghost tap), `domain/interaction-history.ts`, `domain/keymap.ts` and `keymap.test.ts`, `ui/use-canvas.ts`
- Modify: `domain/geometry.ts`, `domain/hit-test.ts` (move `distance` and `segmentDistance`)
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Produces:
  ```ts
  // interaction.ts
  // InteractionState gains `readonly suggestions?: Suggestions`;
  // InteractionCommand gains `| SuggestCommand`; Announcement gains `| SuggestAnnouncement`.
  // interaction-suggest.ts
  /** A tap on a ghost accepts it; `undefined` when the tap is not on a ghost, or lands on a pin (D11). */
  export const ghostTap: (state: InteractionState, gesture: Gesture, context: InteractionContext) => Interpreted | undefined;
  /** Escape's ghost step: dismisses them; `undefined` when none show. */
  export const dismissGhosts: (state: InteractionState) => Interpreted | undefined;
  /** The ghosts after an edit: kept, minus the accepted ones, only when the edit was that accept (D10). */
  export const suggestionsAfter: (suggestions: Suggestions | undefined, scene: Scene) => Suggestions | undefined;
  export const SUGGEST_COMMANDS: SuggestHandlers;  // spread into WIRING_COMMANDS
  // keymap.ts
  interface KeyContext { readonly wiring: boolean; readonly ghosts: boolean; readonly ghostFocused: boolean; readonly focus?: InstanceId | undefined }
  ```

- [ ] **Step 1: Write the failing tests** in `interaction-suggest.test.ts` (fixtures from `interaction.fixtures.ts` and Task 2's register file):
  - `suggestWires` with nothing selected sets 20 ghosts, emits **no `dispatch`**, and announces `suggested` with 20. With one `Reg` selected, 5. With nothing to propose, no `suggestions`, and `suggested` with 0. It closes the card and menu, disarms an armed pin, stops a placement, and keeps the selection (D15).
  - `acceptGhost` with an index dispatches **one** `connectWires` with that one wire in `state.wireColor`, sets `accepting` to its id, keeps the other 19, and announces `accepted` with 1. Without an index it accepts the focused ghost; with none focused it does nothing.
  - `acceptAllGhosts` dispatches one `connectWires` with all remaining ghosts, removes `suggestions`, and announces `accepted` with their count.
  - `dismissGhosts` removes them, dispatches nothing, and announces `dismissed`.
  - `nextGhost` focuses 0, then 1, and wraps; backwards from none focuses the last. It announces `ghostFocused`, and moves the camera when the ghost is off screen.
  - `ghostTap`: a tap on a ghost's middle accepts it; on its end pin, `undefined` (the pin wins); on empty canvas, `undefined`; with no ghosts, `undefined`.
  - **History (D10):** `suggestionsAfter` keeps the ghosts minus the accepted one when the scene has the `accepting` wire, and drops `accepting`. It drops all ghosts when the scene doesn't have it (another edit, or the accept was refused). A remaining ghost that is now illegal is dropped. `afterHistory` uses it, so an undo, redo, chip switch or any other edit clears the ghosts (Review Focus 4).
  - **Never applied without confirmation (Review Focus 1):** `suggestWires`, `nextGhost`, `dismissGhosts`, Escape and `historyChanged` never emit `dispatch`.
  - **Escape order (D12):** with pins selected and ghosts, the first Escape clears the pins, the second the ghosts, the third the card.
  - `interact` test: a tap gesture on a ghost goes to `ghostTap` before `onGesture`.
  - `keymap.test.ts`: `Shift`+`W` → `suggestWires`; `Ctrl`+`W` and `Ctrl`+`Shift`+`W` → `undefined` (left to the browser, D13); `n`/`N` with `ghosts: true` → `nextGhost`, with `ghosts: false` → `nextWire` as before; `Enter` with `ghostFocused: true` → `acceptGhost`, else as before.
  - `announcements-suggest.test.ts`: every text in `en` and `es`, including a ghost to a bus bit (`d.2`).
  - **Unchanged (Review Focus 5):** the existing `interaction-*.test.ts`, `keymap.test.ts` and `interact.test.ts` cases pass without edits.
- [ ] **Step 2:** Run `pnpm vitest run src/features/circuit-editor/domain`. Expect FAIL.
- [ ] **Step 3: Implement.**
  - Move `distance` and `segmentDistance` to `geometry.ts` first (`refactor(circuit-editor): share the segment distance`, its own commit).
  - `suggestWires` runs `suggestWires` then `ghostsOf` from Tasks 2 and 3.
  - `interaction-wiring.ts` spreads `SUGGEST_COMMANDS` into `WIRING_COMMANDS`, and `cancelWiring` ends with `clearPins(state) ?? dismissGhosts(state)`.
  - `interact.ts`: `case "gesture"` returns `ghostTap(...) ?? onGesture(...)`.
  - `interaction-history.ts`: `afterHistory` takes `suggestions` out of `rest` and adds back `suggestionsAfter(...)` when defined.
  - `keymap.ts`: a `GHOST_KEYS` lookup consulted first when `context.ghosts`, so `plainKey` stays under complexity 10. `WITH_CTRL` doesn't change.
  - `use-canvas.ts` fills `ghosts` and `ghostFocused`.
- [ ] **Step 4:** Run `pnpm vitest run src/features/circuit-editor`, `pnpm typecheck` and `pnpm lint`. Expect PASS, with no file over 300 lines or 10 modules, and ≥ 95 % branches on the new domain files.
- [ ] **Step 5: Commit:** `feat(circuit-editor): suggest, cycle, accept and dismiss ghost wires`.

### Task 5: Drawing ghosts (judgement)

**Files:**
- Create: `adapters/draw-ghosts.ts` and its test; `ui/ghosts-of.ts` and its test
- Modify: `adapters/draw-overlays.ts` (`OverlayView` gains `ghosts`; call `drawGhosts` after `drawWiring`), `ui/render-state-of.ts`

**Interfaces:**
- Produces:
  ```ts
  // draw-ghosts.ts
  export interface GhostView { readonly route: readonly Point[]; readonly focused: boolean }
  export interface GhostsView { readonly ghosts?: readonly GhostView[]; readonly ghostColor?: WireColor }
  export const drawGhosts: (frame: PaintFrame & Pick<Frame, "visible">, view: GhostsView) => void;
  ```

- [ ] **Step 1: Write the failing tests:**
  - `ghostsOf` maps `suggestions` to routes and marks the focused one; with none, nothing.
  - Draw test with a recording context, like `draw-picked-pins.test.ts`: each visible ghost is stroked with a dash set and the reduced alpha, and the dash is reset afterwards; the focused one also gets a halo; a ghost wholly off screen is skipped.
  - Contrast test (D17): the ghost stroke, blended at its alpha over the canvas colour, gives ≥ 3:1 against the canvas in every theme, for the default wire colour and every wire colour token.
- [ ] **Step 2:** Run them. Expect FAIL. Implement. Expect PASS.
- [ ] **Step 3:** Check by hand in `pnpm dev`, in every theme: import the register file, press `Shift`+`W`, and see 20 dashed ghosts; press `n` and see the halo move. Check that there are no console errors.
- [ ] **Step 4: Commit:** `feat(circuit-editor): draw suggested wires as dashed ghosts`.

### Task 6: The bar, the toolbar button, the canvas menu and the keyboard help (judgement)

**Files:**
- Create: `ui/SuggestionsBar.tsx` (+ `.module.css`, reusing the selection bar's dock rules)
- Modify: `domain/selection-bar.ts` and its test, `ui/ModeOverlays.tsx`, `ui/CanvasControls.tsx`, `ui/WireMenus.tsx`, `application/library-bridge.ts`, `ui/KeyboardHelp.tsx`
- Modify: `src/features/chip-library/ui/QuickAdd.tsx`, `quick-add-view.ts` and its test
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Produces:
  ```ts
  // selection-bar.ts
  /** The selection bar also hides while ghosts show (D14). */
  export const barVisible: (state: InteractionState) => boolean;
  /** The suggestions bar shows while ghosts do, unless a menu, dialog or drag has the canvas's attention. */
  export const suggestionsBarVisible: (state: InteractionState) => boolean;
  // library-bridge.ts
  interface CanvasMenuContext { /* … */ readonly suggestWires: () => void }
  ```

- [ ] **Step 1: Write the failing domain tests:** `barVisible` is false with chips selected while ghosts show; `suggestionsBarVisible` is true with ghosts and false with none, or with a menu open, or during a drag. `quick-add-view` lists a Suggest wires pick next to Tidy wires.
- [ ] **Step 2:** Run them. Expect FAIL. Implement. Expect PASS.
- [ ] **Step 3: UI.**
  - `SuggestionsBar`: a `Toolbar` labelled "Suggested wires", with the count as text ("Suggested wires: 20"), then **Accept all** (`acceptAllGhosts`) and **Dismiss** (`dismissGhosts`) buttons. Focus returns to the canvas host when the bar goes away, as `SelectionBar` does.
  - `CanvasButtons`: **Suggest wires** after Tidy wires.
  - The default canvas menu: entries Tidy wires and **Suggest wires**. `QuickAdd`: a Suggest wires pick that calls `context.suggestWires()`.
  - `KeyboardHelp`: rows for `Shift`+`W`, `n`/`N` and `Enter` with ghosts showing, and `Escape` dismissing them.
  - Every string in `en` and `es`.
- [ ] **Step 4:** Check by hand in `pnpm dev`, at desktop and phone width: the toolbar button, the canvas menu (right-click on empty canvas, and long-press on touch), and the quick-add pick each show the ghosts; Accept all adds them and one Undo removes them; tapping one ghost adds one and the bar's count drops; moving a chip clears the ghosts. Check that there are no console errors.
- [ ] **Step 5:** Run `pnpm vitest run src/features/circuit-editor src/features/chip-library`, `pnpm typecheck` and `pnpm lint`. Expect PASS.
- [ ] **Step 6: Commit:** `feat(circuit-editor): suggest wires from the toolbar, the canvas menu and a bar`.

### Task 7: Register file fixture, E2E, axe and perf (mechanical)

**Files:**
- Modify: `src/features/projects/domain/e2e-fixtures.test.ts` (+ `registerFileProject`, ≈ 45 lines)
- Create: `e2e/fixtures/register-file.json` (generated), `e2e/suggest-wires.spec.ts`, `e2e/a11y-suggest.spec.ts`
- Reuse: `e2e/support.ts`, `wiring-support.ts` (`pointerFor`, `usesTouch`, `wiresOf`), the export helpers `multi-wire.spec.ts` uses

- [ ] **Step 1: The fixture.** `registerFileProject`: a saved `Reg` chip with inputs `d0`…`d3`, `load`, `clk` and outputs `q0`…`q3` (inside, one NAND per bit from `dk` and `load` to `qk`, so it is a real saved chip). `Main` (open) holds a 4-bit input piece `d`, a 1-bit input `clk`, inputs `load0`…`load3`, and four `Reg`s in a column. No wires. Regenerate with `UPDATE_E2E_FIXTURES=1 pnpm vitest run src/features/projects/domain/e2e-fixtures.test.ts`.
- [ ] **Step 2:** In `suggest-wires.spec.ts`:
  - **Done when (issue #16):** import `register-file.json`, click **Suggest wires** on the toolbar. Expect the bar "Suggested wires: 20", the announcement "Wires suggested: 20", and **no wires in the export** (nothing applied). Click **Accept all**. Expect 20 wires: `clk` to each `Reg`'s `clk`, and bits 0–3 of `d` to each `Reg`'s `d0`…`d3` in order (from the export's `from.bit`). No `load` pin is wired. One Undo leaves 0 wires; one Redo gives 20.
  - **Scope:** select one `Reg`, press `Shift`+`W`: "Suggested wires: 5".
  - **Accept one:** suggest, click the middle of one ghost: 1 wire, and the bar reads 19. Click **Dismiss**: the bar goes, still 1 wire.
  - **Any edit clears:** suggest, then nudge a chip with an arrow key: the bar goes, and no wire was added.
  - **Keyboard only:** focus the canvas, `Shift`+`W`, `n`, `n`, `Enter`: 1 wire, announced; `Escape`: the bar goes.
  - **Touch only (phone and tablet projects):** long-press empty canvas, pick Suggest wires, tap **Accept all**: 20 wires.
  - **Nothing to suggest:** after Accept all, suggest again: "No wires to suggest", and no bar.
  - **Unchanged:** `n` with no ghosts still steps through wires (the existing keyboard wiring spec covers this; it must still pass).
- [ ] **Step 3:** In `a11y-suggest.spec.ts`, run axe in every theme with the bar showing and a ghost focused. Copy the setup from `a11y-multi-wire.spec.ts`.
- [ ] **Step 4:** Run `pnpm build && pnpm e2e --grep "suggest"`, then `pnpm e2e --grep "wiring|multi-wire|keyboard"`. Expect PASS on every project.
- [ ] **Step 5:** Run `pnpm e2e:visual:docker`. No baseline should change: none shows ghosts, and the toolbar's new button may move nothing that is snapshotted. If one does change, find out why, then update with `--update-snapshots=all` and commit only Linux baselines.
- [ ] **Step 6:** Run `pnpm e2e:perf` (p95 ≤ 20 ms), then `pnpm check`. Expect PASS.
- [ ] **Step 7: Commit:** `test(e2e): suggest wires on a register file, and check the bar with axe`.

### Task 8: Docs and PR (mechanical)

- [ ] **Step 1:** Rewrite this plan's Status as 5b's: what shipped, the spike and timing numbers, rulings made while building, and known follow-ups.
- [ ] **Step 2:** Record the decisions in `docs/adr/0050-suggest-wires.md`. Add **Suggest wires**, **Ghost wire**, **Numbered series** and **Suggestions bar** to `GLOSSARY.md`. Update the spec's §3.3 shortcut line if the owner chose a different shortcut (D13).
- [ ] **Step 3:** Open the PR with the `pr` skill; its body says it completes issue #16 ("Closes #16"). Then run one `sonnet` review over the whole PR, and fix what it finds in one wave.

## Not in this PR

- A series of 1-bit sources into the bits of an unconnected sink bus (D19).
- Fuzzy name matching beyond the numbered series, and learning from past choices (spec §4).
- Suggestions appearing without being asked (spec §3.3.1).
- Accepting a chosen subset other than one at a time or all.
