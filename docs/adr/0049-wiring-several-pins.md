# 49. Wiring several pins at once (reads the Phase 5 spec §3.2)

The user selects several pins, then taps a source pin, and every selected pin is wired to it as one undo step. A source as wide as the selected pins fans out. A wider source is wired bit by bit into 1-bit pins, in selection order. With an Array of 16 RAM cells selected, "Select this pin on all selected chips" picks all 16 `clk` pins at once, so issue #16's "wired in one step" holds.

## Where the logic lives

- `circuit-editor/domain/pin-selection.ts`: the pin list operations (`togglePinIn`, `appendPins`, `samePinOn` in reading order) and the types the selection re-exports (`BulkWireError`, `BulkRefusal`, `Notice`, `PinCommand`, `PinAnnouncement`). It imports neither `selection.ts` nor `interaction.ts`.
- `domain/bulk-wiring.ts`: `planBulkWires` is a pure function that returns the wires to add, or the first refusal and the pin to blame.
- `connectWires` in `domain/wire-edits.ts` is the editor action. 5c's Accept all will reuse it.
- `domain/interaction-pin-select.ts` holds the `togglePin`, `selectPinOnAll` and `togglePinPick` commands and the bulk wire itself. They are registered with the wiring commands, because `interaction-commands.ts` is at its import limit.
- `domain/announcements-pins.ts` words the announcements and the canvas notice, so the two match.
- `ui/picked-of.ts` and `adapters/draw-picked-pins.ts` draw the picked pins and the refused pin.

## Decisions

1. **The pin selection is part of `Selection`**, as `pins: readonly PinRef[]`, in the order the pins were added, with no repeats and no bit. Like the rest of the selection it stays out of undo. A plain tap on a chip or a wire clears it. `Shift`+tap on a chip keeps it. `prune` drops a pin whose chip, or whose pin, is gone.
2. **Adding pins.** `Shift`+tap (or `Shift`+click) on a pin adds it, or removes it if it is there, and disarms any armed pin. While **Pick pins** is on, a plain tap does the same. `Shift`+`Space` adds or removes the pin in the pin card.
3. **"Select this pin on all selected chips"** (`a`, or the button beside a pinned card) adds the card's pin on every selected chip of the card's chip's kind, in **reading order**: top to bottom by anchor, then left to right, then instance order. For an Array that is row by row. Pins already in the list keep their places.
4. **A source wires the selection.** With pins selected and nothing armed, a plain tap on a pin, or `Enter` on the card's pin, plans the bulk wire with that pin as the source. Tapping a selected pin is refused ("That pin is one of the selected pins"). A wire drag still draws one wire and leaves the pin list alone.
5. **The legal cases.** Widths are as a wire sees them, and an input piece counts as an output because it drives.
   - **Fan-out:** the source is an output and every selected pin is an input of its width.
   - **Bit by bit:** the source is N > 1 bits and every selected pin is 1 bit. Selected pin k gets bit k. Fewer than N pins wire the low bits, and more than N are refused at pin N + 1.
   - **Reverse:** the source is an input and the selected pins are outputs. Bit by bit works as above, each wire running from the selected pin to bit k of the source. **Same-width reverse is legal for a single pin only (owner, 2026-11-03)**, since that is the wire a plain tap would make. With two or more it is refused, because an input takes one wire.
   - Anything else is refused: mixed widths or directions, or selected pins facing the same way as the source.
6. **All or nothing.** Each planned wire is checked with `checkConnection` against the circuit plus every wire planned before it. So an input that already has a wire, or two wires landing on one bit, refuse the lot before anything changes. The refusal names the first offending pin. The canvas notice reads "{pin} on {chip}: {reason}", the same words are announced, and the pin gets a red ring until the notice clears. The pin list stays, so the user can fix that pin and tap the source again.
7. **`connectWires` is one action and one undo step.** It checks every wire again, the same way the plan does, and never trusts the plan. It routes all the new wires in one `settled` call. An empty list is refused (`NothingToConnect`), so it never makes an empty history entry. Every wire gets the current wire colour.
8. **After a bulk wire** the pin list clears, Pick pins turns off, the chips stay selected, and the announcement says "Wired 16 pins to clk" or "Wired 4 pins to bits 0–3 of bus".
9. **Pick pins is a toggle in the selection bar (owner, 2026-11-03)**, the touch path the spec calls an "additive toggle". The bar now shows while chips or pins are selected. Duplicate, Array… and Delete show only with chips. `src/shared/ui` gains a `ToggleButton`. While Pick pins is on, a tap on any pin picks it, so a touch user turns it off before tapping the source. It also turns off on Escape, when the selection is cleared, and after a bulk wire.
10. **Keys.** `Shift`+`Space` toggles the card's pin, `a` picks the card's pin on all selected chips, and `Enter` with pins selected wires them to the card's pin. Escape clears, in order: the bit picker, a placement, the armed pin, then the pin list and Pick pins, then the card, then the chip selection.
11. **A right-click on a pin pins its card open and keeps the selection (owner, 2026-11-03)**, as a long-press does on touch. Before, it selected only that chip and opened the chip menu, which threw away a 16-chip selection, and a mouse has no long-press, so mouse users could not reach the card's button. A right-click on a chip body still opens the chip menu.
12. **Drawing.** Each picked pin gets a ring in the focus-ring colour and its 1-based order number in the text colour. The number hides below 10 screen px, which is below about zoom 0.7. The refused pin's ring uses the red wire colour, the colour the notice's border uses. Wire colours are already contrast-checked against the canvas in every theme, so no new token was added.

## Calls made while building

- **Hit targets in a dense Array.** A 4 × 4 Array of NANDs with spacing 0 has pin anchors 20 world px apart. A tap exactly on an anchor gets its own pin at every zoom, from 0.25 to 4. A tap 6 screen px off can land on a neighbour below zoom 0.6. That is acceptable, since "on all selected chips" doesn't need precise taps, so `Shift`+tap is not limited to selected chips.
- **Timing.** `connectWires` of 64 wires from one source to a 64-NAND column takes about 6 ms (median of 7), within a 16 ms frame. The test asserts under 200 ms, because coverage slows it about 15 times.
- **`Drag` moved to `gesture-types.ts`**, to give `interaction.ts` room under its line limit.
- **`prune` takes the scene**, not the circuit, because checking that a chip still has a pin needs its layout.
- **`chipLabel` moved to `domain/chip-label.ts`**, so `announcements-pins.ts` can use it without an import cycle.
- **The notice moves below the selection bar.** With pins selected the bar stays up when a bulk wire is refused, and both sat at the top centre, so the bar hid the notice. On a wide canvas the notice now sits below the bar. On a phone the bar is at the bottom, so nothing moves.
- **`[` and `]` replace the chip selection, so they clear the pins**, as a plain tap on a chip does. From the keyboard, `Shift`+`[` or `Shift`+`]` reaches the source with the pins kept.
- **The card's button needs a pinned card.** Moving the mouse from the canvas to the button would close a hover card, so only a pinned card offers it.
- **Widths that fit no case** (a 4-bit source with 8-bit pins) are not given their own error. They fall through to `checkConnection`, which reports a width mismatch at the first pin.

## Follow-ups

- Bulk wiring by dragging, and selecting pins with a box or lasso.
- Suggest wires (5c) will reuse `connectWires` and the pin selection.
