# Editor Phase 5: Bulk editing (design)

**Builds on:** the circuit editor design (`2026-10-29-circuit-editor-design.md`, §5.7 Bulk work, §5.2 Wiring, §5.10 bit taps), ADR 39 (wires reference pin IDs), and copy, cut and paste from PR #28. Those decisions still stand unless this document says otherwise. It adds what the owner decided for Phase 5 on 2026-11-02 and marks the builder's own calls.
**Issue:** #16.
**Branch:** `claude/phase-5a-duplicate-array`, from `main` at 2f938ae (PRs #28 and #29 merged).

## 1. Intent and why

After Phase 4 you can build and reuse chips, but every copy of a chip is placed by hand, and every wire is drawn one at a time. The owner's path heads towards registers and RAM, which are many copies of the same cell sharing a clock and a bus. Without bulk tools, that is hundreds of taps.

**Success (issue #16, "Done when"):**
- 16 RAM cells are placed with one Array action, and their `clk` pins are wired to one clock source in one step.
- On a register file example, Suggest wires proposes sensible connections, and nothing is applied until it is confirmed.
- Undo reverts each bulk action as one step.

## 2. Delivery: three PRs, in this order (owner)

Each PR is usable on its own and merges to `main` before the next one starts.

1. **Duplicate and Array (5a).** Everything in §3.1.
2. **Wiring several pins at once (5b).** Everything in §3.2.
3. **Suggest wires (5c).** Everything in §3.3. It completes issue #16's "Done when".

## 3. Goals

### 3.1 Duplicate and Array (PR 5a)

1. **A selection bar (owner: Array opens from the selection's actions).**
   - When one or more chips are selected, a small bar appears, docked at the top centre of the canvas. It holds **Duplicate**, **Array…** and **Delete**. On phones it sits at the bottom of the canvas, above the safe area (my call).
   - **It does not float by the selection (owner, 2026-11-03).** A floating bar covered the neighbouring chips, and a click meant for one of them landed on Delete.
   - The bar hides while a drag, wiring or placement is in progress.
   - The chip menu (long-press or right-click) gains Duplicate and Array… too. Phase 2 left Duplicate out until this phase.
2. **Duplicate.**
   - Copies the selection one grid step down and to the right, keeping the wires inside the selection and dropping wires to chips outside it (spec §5.7).
   - It reuses PR #28's `copyOf` / `pastedFrom` and the `pasteItems` action, so it is one undo step. The copies become the selection.
   - Pins copy the same way as paste: a pasted pin takes the next free name of its direction.
   - **It does not touch the clipboard (my call).** Duplicate followed by Paste pastes what you last copied, not the duplicate.
   - Shortcut: `Ctrl`/`⌘`+`D`.
3. **Array (owner: a dialog).**
   - Array… opens a dialog with three fields:
     - **count**: the total number of copies to add, 1–64, default 3;
     - **direction**: row, column or grid; a grid also asks for the number of columns;
     - **spacing**: the gap between copies in grid steps, 0–8, default 1.
   - Each copy is offset by the selection's bounding box plus the gap, so copies never overlap the originals, and every position snaps to the grid (spec §5.7).
   - Each copy keeps the wires inside the selection, as Duplicate does. Copies are not wired to each other.
   - The whole array is **one `pasteItems` action**, so it is one undo step. The originals and all copies become the selection, so a follow-up Array or move acts on the whole block (my call).
   - Shortcut: `Ctrl`/`⌘`+`Shift`+`D` opens the dialog.
   - The dialog shows the resulting size ("4 × 4, 16 chips") so the outcome is clear before confirming. There is no live ghost preview (owner chose the dialog).
4. **Announcements.** Duplicate and Array announce what they added ("Added 15 chips"), in `en` and `es`.

### 3.2 Wiring several pins at once (PR 5b)

1. **Selecting pins (my call).** Today a selection holds chips and wires. It gains an ordered list of **pin ends** (`PinRef`s), kept in the order they were added.
   - `Shift`+tap on a pin, or a tap on a pin while the additive toggle is on (touch), adds it to the pin selection. Tapping a selected pin that way removes it.
   - **"Select this pin on all selected chips"** in the pin card (my call). With 16 RAM cells selected, opening the `clk` pin's card on one of them and choosing this selects all 16 `clk` pins, in canvas order. This is what keeps the "Done when" to one step.
   - Selected pins are drawn with a ring and a small order number.
   - Keyboard: `p`/`P` moves the pin focus as today. `Shift`+`Space` adds or removes the focused pin.
2. **Then tap a source.** With pins selected, tapping (or `Enter` on) a pin outside the selection wires them all at once (spec §5.7). Only these cases are legal:
   - **Same width:** every selected pin has the source's width. Each gets its own wire from the source (fan-out). A 1-bit clock to 16 `clk` pins is this case.
   - **Bit by bit:** the source has N bits and every selected pin is 1-bit. The first selected pin gets bit 0, the next bit 1, and so on, using bit taps (spec §5.10). Selecting fewer than N pins wires the low bits only. Selecting more than N is refused (my call).
   - The reverse direction works the same way: if the source is an input and the selected pins are outputs, each wire runs from a selected pin to the source. A source input can take only one wire, so this is legal only in the bit-by-bit case.
   - Anything else is refused with a translated reason, and nothing is wired.
3. **All or nothing (my call).** If any one of the wires is illegal (for example, an input already has a wire), the whole action is refused, the reason names the first offending pin, and that pin is highlighted. A partial bulk wire is harder to understand than a refusal.
4. **One undo step.** A new action, `connectWires`, adds every wire at once. Afterwards the pin selection clears.
5. **Announcements.** "Wired 16 pins to clk", "Wired 4 pins to bits 0–3 of q", in `en` and `es`.

### 3.3 Suggest wires (PR 5c)

1. **On demand (owner).** Suggest wires runs only when asked: a **Suggest wires** button in the toolbar, also in the canvas menu, with the shortcut `Ctrl`/`⌘`+`Shift`+`W`. Nothing appears unasked.
   - With chips selected, it suggests only wires that touch the selection. With nothing selected, it considers the whole chip (my call).
2. **What it proposes (spec §5.7).** It proposes wires only into unconnected inputs: inputs of parts and circuit output pieces that have no wire. Rules, in order. An input takes the first rule that gives it exactly one source:
   1. **Same name**, case-insensitive: an output called `clk` to an input called `clk`.
   2. **Numbered series:** names that differ only in a trailing number, matched index by index. `d0..d3` → `q0..q3`. A series also matches the bits of a bus of the same width, for example `d0..d3` → bits 0–3 of a 4-bit `q` (issue #16).
   3. **Only legal option:** exactly one output in reach has the right width and would not create an illegal wire.
   - Ties are never broken by guessing. If two outputs are both called `clk`, that input falls through to the next rule, and if no rule gives one answer, it is left alone.
   - It never proposes a wire from a chip to itself (my call; feedback loops are drawn on purpose).
3. **Ghost wires.** Proposals show as dashed, translucent wires routed like real ones. A bar shows "**N suggested wires** · Accept all · Dismiss".
   - Tapping a ghost accepts that one wire. Accept all adds every remaining ghost. Dismiss, or `Escape`, removes them all.
   - Keyboard: `n`/`N` cycles through the ghosts, `Enter` accepts the focused one.
   - Any edit to the circuit while ghosts are showing clears them, so a stale proposal is never accepted.
4. **Never wires without confirmation.** Ghosts live in interaction state, not in the circuit. Accepting is the only edit. Accept all is one `connectWires` action (from 5b), so it is one undo step, and accepting one ghost is one step too.
5. **Announcements.** "8 wires suggested", "Accepted 8 wires", "No wires to suggest", in `en` and `es`.

## 4. Non-goals

- A live ghost preview while setting up an Array (the owner chose the dialog).
- Copying to the system clipboard, or between projects.
- Suggest wires learning from past choices, or fuzzy matching beyond the numbered series (for example, `in`→`input`).
- Bulk edits of pin widths or names.
- Wiring copies of an Array to each other (a chain or bus) as part of the Array action.

## 5. Anti-goals (a failure even if it works)

- Any bulk action that takes more than one undo step to revert.
- Suggest wires changing the circuit before an accept.
- A bulk wire that half-applies and leaves you to work out which pins were wired.
- An Array that can only be built by mouse. Every action needs a tap path and a keyboard path.
- Selecting 16 `clk` pins one tap at a time being the only way to wire them.

## 6. Constraints

- The project rules in `CLAUDE.md` apply: feature folders exposing only `index.ts`, `Result` instead of `throw` in `domain/`, Zod only at trust boundaries, react-aria only in `src/shared/ui`, and every string through Paraglide in `en` and `es`.
- Lint limits: files ≤ 300 lines, functions ≤ 50 lines, ≤ 3 parameters, complexity ≤ 10, ≤ 10 imports per file. New logic goes in new files (`array.ts`, `pin-selection.ts`, `bulk-wiring.ts`, `suggest-wires.ts`, and their `interaction-*` command files).
- `domain/**` needs 95% branch coverage per file, so logic goes in `domain/`, and `ui/` stays thin.
- `pnpm e2e:perf` must keep p95 ≤ 20 ms. An Array of 64 copies and Suggest wires on a 200-part chip must each finish within one frame budget; measure both.
- Axe passes with the selection bar, the Array dialog and the suggestions bar open, in every theme.

## 7. What already exists (verified on `main` at 2f938ae)

- `domain/clipboard.ts`: `copyOf` / `pastedFrom` (fresh ids, wire ends remapped, bends shifted, pins renamed to the next free name).
- `domain/batch-edits.ts`: the `pasteItems` action, one undo step for parts, pins and wires.
- `domain/interaction-clipboard.ts`: the copy, cut and paste commands, with the paste offset and the "lands in view" rule.
- `domain/selection.ts`: `Selection` holds `instances` and `wires`. There is no pin-level selection yet.
- `domain/interaction-wiring.ts`: the armed state with legal-target highlighting, `connectWire`, and the bit picker for bus ends.
- `ui/CanvasMenus.tsx`: the chip menu (Delete, plus Rename, Recolour and Look inside for custom chips).

## 8. Left to the builder

- Array dialog defaults beyond those above, and whether the grid column count defaults to √count.
- Ghost wire styling, within the existing wire tokens and a contrast check.
- How the numbered-series rule splits a name into stem and number (`d0`, `d_0`, `D[0]`).

## 9. Risks to spike early

- **Routing cost of a big Array.** 64 copies with inner wires means many routes at once. Measure in 5a before building the dialog. If it is slow, route lazily or in one batch.
- **Pin hit targets in a dense Array.** `Shift`+tap on 16 adjacent `clk` pins must not miss. The "on all selected chips" path is the fallback, so check it early in 5b.
- **Suggest wires on a large chip.** The "only legal option" rule is a search over every input × output pair. Check it on a 200-part chip at the start of 5c.
