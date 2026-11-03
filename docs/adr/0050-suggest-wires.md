# 50. Suggesting wires (reads the Phase 5 spec §3.3)

On request, the editor proposes wires into unconnected inputs and draws them as dashed ghost wires, with a bar reading "Suggested wires: N", **Accept all** and **Dismiss**. Nothing changes in the circuit until the user accepts. Tapping a ghost, or `Enter` on the focused one, accepts that one wire. Accept all adds the rest as one undo step. On a register file the proposals are sensible, and ties are left alone. This completes issue #16.

## Where the logic lives

- `circuit-editor/domain/suggest-names.ts`: the name of each pin end (user-named pins only), the split of a name into stem and number, and the indexes of sources by name, by stem and by width.
- `domain/suggest-wires.ts`: the three rules, applied in one pass over the chip's inputs with index lookups. It returns the wires to propose in reading order.
- `domain/ghost-routes.ts`: routes the proposals over a draft circuit with one `settled` call, up to `GHOST_ROUTE_CAP`. Above the cap it returns elbows.
- `domain/suggestion-types.ts`: `Suggestions`, `Ghost` and the constants.
- `domain/interaction-suggest.ts`: the commands (suggest, cycle, accept one, accept all, dismiss). They are registered with the wiring commands, because `interaction-commands.ts` is at its import limit. Accepting dispatches 5b's `connectWires`.
- `domain/announcements-suggest.ts`: the announcements. Pin announcements go through it too, because `announcements.ts` is at its import limit.
- `adapters/draw-ghosts.ts` draws the ghosts. `ui/SuggestionsBar.tsx` is the bar, and `ui/DockedBar.tsx` holds the dock and focus-return logic it shares with the selection bar.

## Decisions

All were approved with the plan on 2026-11-03 unless marked as the owner's call.

1. **Where wires can go.** A sink is a part's input or a circuit output piece. A source is a part's output or a circuit input piece. Only sinks with no wire on any bit get proposals. Sources may already fan out. A proposal never joins two pins of one chip.
2. **Scope filters the result, not the search.** Suggestions are always worked out over the whole chip. With chips selected, only proposals with an end on a selected chip are kept. So "exactly one source" is never judged on a filtered view.
3. **Names come only from pins the user named.** Rules 1 and 2 match the names of custom chip pins and pin pieces. Built-in parts (NAND `a`, `b`, `out`, split and merge bits) take part only in rule 3. Otherwise an input piece called `a` would be proposed into every NAND.
4. **A candidate must be legal.** Each rule counts only sources that pass `checkConnection`. A same-named output of the wrong width is not a candidate, so it causes no tie.
5. **Rule 1, same name** (ignoring case). Exactly one legal candidate is proposed. Two or more is a tie, and the sink falls through to rule 2.
6. **Rule 2, numbered series.** A name that ends in digits splits into a stem and a number (`d0`, `d_0`, `D[0]` are stem `d`, number 0). A series is two or more pins with the same stem and different numbers. A sink series matches a source series with the same numbers, pin k to pin k, or one source bus as wide as the series, when the numbers are 0 to width − 1 and every sink is 1 bit. Two passes: candidates with the same stem (or bus name) first, and exactly one wins. Only if none matches by name are all candidates tried, and again exactly one wins. A series is matched as a whole.
7. **Rule 3, the only legal option.** Exactly one source on the chip, not on the sink's own chip, has the sink's width and passes `checkConnection`. Bits of a wider bus are not counted. Ties and no candidates leave the sink alone.
8. **Order.** Proposals are sorted by their sink in reading order. `n` steps through them in this order.
9. **Ghosts live in interaction state only**, outside undo history. They are routed once, when suggesting, in world units. **Up to `GHOST_ROUTE_CAP` they are routed like real wires; above it they are elbows, and a wire is routed only when accepted (owner, 2026-11-03).** The cap is 64.
10. **Accepting.** Tapping a ghost, or `Enter` on the focused one, makes one `connectWires` in the current wire colour, and the other ghosts stay. Accept all makes one `connectWires` for all remaining ghosts. Dismiss or `Escape` drops the ghosts and dispatches nothing. Any other change (an edit, undo, redo, switching chips) clears the ghosts: an accept stores its new wire ids, and the ghosts survive only if all of them are now in the circuit. The ghosts that remain are checked again.
11. **Tapping.** A pin beats a ghost, and a ghost beats a chip body, a name and a wire. A ghost's reach is 12 screen px, like a wire's. The ghost tap goes through `interact.ts`, before `onGesture`.
12. **Keyboard.** While ghosts show, `n`/`N` step through them, bring the focused one into view and announce its ends. `Enter` accepts the focused ghost. `Escape` clears the ghosts after the pin list and before the card.
13. **The shortcut is `Shift`+`W` (owner, 2026-11-03).** The spec asked for `Ctrl`/`⌘`+`Shift`+`W`, but Chrome, Edge and Firefox reserve it to close the window, so a page never gets the key. `Shift`+`W` is free and works while the canvas has focus. The toolbar button and the canvas menu are the discoverable paths.
14. **The suggestions bar** docks where the selection bar does (top centre, bottom on phones). It reads "Suggested wires: {count}" with **Accept all** and **Dismiss**. The selection bar hides while ghosts show, so they never overlap. When the bar goes away while it had focus, focus returns to the canvas.
15. **Running Suggest wires** closes menus and the card, disarms a pin and stops a placement, and keeps the selection, since that is the scope. Running it again replaces the ghosts. With nothing to propose it announces "No wires to suggest" and shows no bar.
16. **Announcements**, in `en` and `es`, in the project's "Label: {count}" form: "Wires suggested: {count}", "Wires accepted: {count}", "No wires to suggest", "Suggestions dismissed", and when `n` focuses a ghost, "Suggested wire {index} of {count}: {from} on {fromChip} to {to} on {toChip}".
17. **Drawing.** Ghosts are dashed, on the overlay layer, in the colour a new wire would get, at the lowest opacity that still gives 3:1 against the canvas in every theme (non-text contrast). A unit test checks it. The focused ghost gets the halo selected wires get.
18. **The canvas menu** gets a **Suggest wires** entry after Tidy wires. The library's quick-add, which replaces that menu, gets one too.

## Calls made while building

- **Timing.** On the 200-part chip (median of 7, no coverage), naive matching took 124 ms and indexed matching 2.3–2.4 ms. Routing 200 ghosts took 100–108 ms and is roughly quadratic. Routing by count: 32 ghosts 3.4 ms, 48 4.8 ms, 64 11.6 ms, 80 15.8 ms, 96 21.3 ms. Elbows for 200 ghosts take 0.7 ms.
- **`GHOST_ROUTE_CAP` is 64, not 80.** 80 fits a frame by itself, but matching adds about 2.4 ms. At 64 both together take about 14 ms, in one 16 ms frame.
- **Timing guards assert under 200 ms**, because coverage slows the code about 15 times.
- **Names only from user-named pins.** A series with repeated numbers (`d1`, `D1`) is not a series. An empty name is unnamed. Series-to-bus candidates are named sources only.
- **`End.width` comes from `endpointInfo`**, not `sideWidth`, which scans.
- **Sorted by sink reading order only.** Each sink gets at most one proposal, so a bit tiebreak could never fire. The `readingOrder` comparator is exported from `pin-selection.ts`, and `samePinOn` uses it.
- **Ghost draft wires use fresh `newWireId()` ids** and are never dispatched. A `ghost:n` cast is banned by lint.
- **`KeyContext.ghosts` and `ghostFocused` are optional**, so the existing keymap tests stay unchanged.
- **A ghost into a bus bit reads `d.2`**, as the pin card does.
- **Focus after accepting one ghost.** It drops by one if the accepted ghost was before it, and wraps if it was the accepted one.
- **Off screen.** A ghost counts as off screen by the midpoint of its route's middle segment.
- **`GHOST_ALPHA` is 0.7.** It is the lowest 0.05 step that gives at least 3:1 in every theme for the default wire and all eight wire colours. The test asserts that 0.65 fails, so the value stays minimal. The default ghost colour is the `wire` token.
- **`DockedBar.tsx`** holds the dock and focus-return logic both bars share. The suggestions bar also hides while the help dialog is open. Accept all is the default button variant and Dismiss is quiet.
- **The e2e ghost-tap point** is computed from the fixture, with no test hook.
- **Checks.** `pnpm e2e:perf`: p95 16.8 ms (drag) and 16.8 ms (glow drag). Visual: 7 of 7, no baseline changed. Firefox can't launch on the machine that built this, so its e2e first runs in CI.

## Follow-ups

- A series of 1-bit sources into the bits of a sink bus (`q0..q3` into a 4-bit output piece).
- Routing ghosts above the cap in the background, or a few at a time.
- Fuzzy name matching beyond numbered series, and learning from past choices.
- Suggestions appearing without being asked.
- `route-perf.test.ts` and `to-netlist-source-perf.test.ts` still flake under load.
