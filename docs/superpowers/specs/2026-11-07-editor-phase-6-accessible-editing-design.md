# Editor Phase 6: Accessible editing (design)

**Builds on:** the circuit editor design (`2026-10-29-circuit-editor-design.md`, §2 goal 10 "Accessibility"), ADR 3 (mobile and accessibility from day one), ADR 21 (axe and keyboard E2E), and the editor as shipped by Phases 2–5 (ADR 42–50). Those decisions still stand unless this document says otherwise. It adds what the owner decided for Phase 6 on 2026-11-07 and marks the builder's own calls.
**Issue:** #17.
**Base:** `main` at e51472f (PRs #30, #31, #32 and #34 merged).

## 1. Intent and why

The editor works well with touch, mouse and keyboard. A screen-reader user still has a problem. The canvas is one `role="application"` host (`CircuitCanvas.tsx:49`). The host speaks what the user selects, moves or wires, but it does not let the user read the circuit. The only readable view is `CircuitSummary` (`src/features/accessibility/ui/CircuitSummary.tsx:98`). It lists parts by name. It shows no pins, no wires and no commands.

A blind user cannot answer "what is connected to this input?" or "wire this output to that input". A keyboard-only user can wire on the canvas (`w`, `p`, `Enter`), but must keep the canvas layout in mind.

**Success (issue #17, "Done when"):**

- A screen-reader or keyboard-only user builds, saves and reuses a half adder without touching the canvas.
- Axe reports no violation on all new UI, in every theme.
- The keyboard E2E suite passes in CI on all browsers.

## 2. Delivery: sub-issues of #17, one PR each

Phase 5 shipped as three PRs. Phase 6 is split finer, so that parallel agents can work on it. Each sub-issue is one PR to `main`, passes `pnpm check`, and ships a working increment. The order is set by blocking edges (GitHub issue dependencies); see the plan, "Sub-issues and order".

1. **Foundations.** The structure model, and the view commands the structure view will send.
2. **The structure view.** It replaces `CircuitSummary`. Pins and wires are readable.
3. **Commands for every action.** Part menu, "Wire to…" dialog, wire menu, circuit-level actions.
4. **Live regions and focus.** One policy for what is spoken, and one rule for where focus goes.
5. **Proof.** Keyboard-only E2E for a half adder and a full adder, axe in every theme, Linux visual baselines, ADR 52.

## 3. Goals

### 3.1 Owner decisions (2026-11-07)

1. **Layout: a Parts list and a Wires list.** Plain headings and nested lists. No composite widget (no treegrid), so the view works with every screen reader.
   - **Parts** lists every part of the open chip in canvas order. A part shows its name, its state (an input as a switch, an output as a live value, "selected") and a pins disclosure. Each pin shows its name, direction, width and what it connects to.
   - **Wires** lists every wire as one row: `Input A out to NAND gate 1 a`. A bit tap reads `Input D bit 2 to NAND gate 1 a`.
2. **Command surface: an Actions menu on each row.** Each part, pin and wire row has a menu button "Actions for {row}". The entries reuse the canvas menus, the existing dialogs and the existing interaction commands. There is no command palette.
3. **Wiring: a "Wire to…" dialog.** On a pin, "Wire to…" (on an output) or "Wire from…" (on an input) opens a dialog. It lists only legal pins, with a search field, and a bit field for buses. One step, and focus stays in the dialog. The dialog uses the same legality check as the armed state.
4. **Placement: the side panel, as a landmark.** The view stays under the Pins panel. It is a labelled region. A skip link ("Skip to circuit structure") reaches it. Pins are collapsed by default, so a big circuit stays short.

### 3.2 Action coverage

Every editor action needs a path that does not use the canvas. The table shows what exists on `main` and what Phase 6 adds.

| Action | Path without the canvas today | Phase 6 |
|---|---|---|
| Place a part | Toolbar "Add NAND"; the library (DOM) | "Add part…" in the view (§3.4) |
| Move | Arrow keys on a selected chip (needs canvas focus) | Part menu: Move left, right, up, down |
| Wire, bit tap | `w`, `p`, `Enter` on the canvas; the bit picker menu | Pin menu: "Wire to…" dialog with a bit field |
| Delete | `Delete` on the canvas | Part menu and wire menu: Delete |
| Rename, recolour, look inside | Chip menu (opened from the canvas) | Part menu |
| Duplicate, Array | `Ctrl`+`D`; the selection bar | Part menu: Duplicate, Array… |
| Wire colour, re-route, branch, bends | Wire menu (opened from the canvas) | Wire menu |
| Pins panel | DOM (`PinsPanel`) | No change. The view links to it. |
| Save, discard | DOM (`ChipHeader`) | No change. Its result is checked (§3.5). |
| Suggest wires | `Shift`+`W`; toolbar; the suggestions bar (DOM) | A "Suggest wires" button and a list of suggestions with Accept in the view |
| Set an input | `Switch` in `CircuitSummary` | No change (kept in the view) |

### 3.3 The structure model (my call)

The view reads from one pure function in `circuit-editor/domain/structure.ts`. It returns `Structure`: parts, pins with their connections, and wires, all with display names and stable ids. It lives in `circuit-editor`, because it needs `Scene`, `endpointInfo` and the pin-name logic that the announcements already use. `circuit-editor` exports it through `index.ts`. The `accessibility` feature renders it and imports only from that index (ADR 23).

Names come from one place. A part's name is `partName` plus its number among parts of the same name (`NAND gate 1`, as `CircuitSummary` does today). A pin's name is the name the pin card and the announcements use. A bit reads `d.2` in a pin card and `bit 2` in a sentence.

### 3.4 Commands (my call)

The view sends **interaction commands**, not editor actions. The interaction store then announces the result through the one live region (§3.5), and the canvas shows the same selection. Two commands are new:

- `selectItems`: selects exactly the given parts and wires. A row menu sends it first, so "Move right" is `selectItems` then `nudge`. It announces the selection as the canvas does.
- `connectPins`: wires two pin ends, with an optional bit on each, as one `connectWire` action. A refused wire announces its reason, as a canvas wire does.

Placing a part uses the existing `placeAt` command with no point (the viewport centre). The new part is selected and its row takes focus (§3.6).

### 3.5 Live regions (my call, except 2)

One policy replaces the four ad hoc regions:

1. **Edits.** The canvas host's polite region stays the one place where edit results are spoken (`CircuitCanvas.tsx:62`). The view sends interaction commands, so its results are spoken there too.
2. **Save and discard.** The header's `<output>` stays (`ChipHeader.tsx:126`). Tests pin "Saved {name}" and "Changes to {name} discarded". Phase 6 checks these results with axe and in the E2E flows. It does not change them.
3. **Dialog-local text.** The Array dialog's size line stays (`ArrayDialog.tsx:96`). The "Wire to…" dialog gets the same: one line that names the chosen pair. A refusal shows in the dialog as `role="alert"`, as the library dialogs do (`LibraryDialogs.tsx:57`).
4. **Simulation outputs.** Each output is an `<output>`, which already has the `status` role (`CircuitSummary.tsx:84` repeats it with `aria-live`). While the clock plays, every tick can change an output, so the outputs go quiet (`aria-live="off"`). A "Read outputs" button speaks all current outputs once. When the clock is paused, outputs speak as today.
5. **Wiring results name the pins.** "Wire added" becomes "Wire added: {from} to {to}". The existing E2E matches `/Wire added/u`, so it keeps passing.

### 3.6 Focus management (my call)

Rules, each pinned by an E2E check:

1. A menu returns focus to its button when it closes (React Aria does this).
2. A dialog opened from a row returns focus to that row's menu button. If the row no longer exists, focus goes to the next row's menu button, then to the previous row's, then to the section heading.
3. Delete moves focus as in rule 2.
4. "Add part…" moves focus to the new part's row.
5. A wire made in "Wire to…" returns focus to the pin's menu button.
6. The skip link moves focus to the region's heading. The heading has `tabIndex={-1}`.
7. The canvas keeps its rule: a dialog opened from a canvas menu or the selection bar returns focus to the canvas host (`use-focus-host.ts`). This does not change.
8. Tab always leaves every component. No trap exists outside a modal dialog.

## 4. Non-goals

- A command palette (owner chose row menus).
- A treegrid or any custom arrow-key model in the view.
- Reading live signal values of one instance inside a parent (spec §5.11 keeps this out of scope).
- Screen-reader support for the minimap. It stays a pointer shortcut and hidden from assistive technology.
- A full rewrite of the canvas's own keyboard map. It is already complete for chips, wires and pins.
- Drag and drop from the view. The library keeps its own "Move to…" path (ADR 46).

## 5. Anti-goals (a failure even if it works)

- A structure view that is only a copy of the canvas, with no way to act. Every row must offer its actions.
- An action that exists only on the canvas, or only in the view. Both paths use the same interaction command.
- A view that steals focus, or that traps it.
- A live region that talks over the user, for example once per clock tick.
- A change that breaks `inputSwitch` and `output` in `e2e/support.ts`. Many specs depend on them.
- A view that makes a 300-part chip slow to drag or select (`pnpm e2e:perf`, p95 ≤ 20 ms).
- Any user string outside Paraglide, in `en` and `es`.

## 6. Constraints

- The project rules in `CLAUDE.md` apply: feature folders expose only `index.ts`, `Result` instead of `throw` in `domain/`, Zod only at trust boundaries, react-aria only in `src/shared/ui`, and every string through Paraglide in `en` and `es`.
- Lint limits: files ≤ 300 lines, functions ≤ 50 lines, ≤ 3 parameters, complexity ≤ 10, ≤ 10 imports per file. `interaction.ts`, `interaction-commands.ts` and `announcements.ts` are at their limits: new logic goes in new files (`interaction-view.ts`, `announcements-view.ts`).
- `domain/**` needs 95% branch coverage per file. Put logic in `domain/`, and keep `ui/` thin.
- Touch targets ≥ 24 px. Menus and dialogs use `src/shared/ui` components.
- Axe passes on every new element in every theme (Light, Dark, High contrast).
- Visual baselines come only from `pnpm e2e:visual:docker --update-snapshots=all`. Never commit macOS baselines.
- `pnpm e2e:perf` keeps p95 ≤ 20 ms. The structure model of the 300-part fixture (`e2e/fixtures/300-chips.json`) takes less than 16 ms (median of 7, no coverage).

## 7. What already exists (verified on `main` at e51472f)

- `src/features/accessibility/ui/CircuitSummary.tsx` (126 lines): `toEntries` (line 37), `EntryControl` (line 68), the output `<output aria-live="polite">` (line 84) and `CircuitSummary` (line 98). It lists parts only. `src/routes/projects.$projectId.tsx:245` renders it under `PinsPanel`.
- `src/features/circuit-editor/ui/CircuitCanvas.tsx:62`: the canvas's polite live region, fed by `useSpoken` (`use-canvas.ts:181`) from `InteractionState.announcement`.
- `domain/interaction.ts`: `InteractionCommand` (line 126), `Announcement` (line 186) and `Effect` (line 214). The canvas keyboard map is `domain/keymap.ts`.
- `ui/CanvasMenus.tsx` (125 lines): the chip menu (`entriesFor`: Delete, Duplicate, Array…, Rename, Recolor, Look inside). `ui/WireMenus.tsx` (179 lines): the wire menu, the canvas menu and the bit picker.
- `src/shared/ui/MenuButton.tsx`: a "⋯" button with a menu. Focus returns to the button on close.
- `ui/use-focus-host.ts`: returns focus to the canvas host after a dialog opened from a canvas menu.
- `ui/ChipHeader.tsx:126`: the save result `<output>`. `ui/ArrayDialog.tsx:96`: the Array size line.
- `application/library-bridge.ts`: `placeAtCentre` (line 29) and `CanvasMenuContext` (line 56).
- E2E: `a11y.spec.ts` and four `a11y-*.spec.ts` files run axe in every theme. `canvas-keyboard.spec.ts` and `canvas-wiring-keyboard.spec.ts` drive the canvas by keyboard. `half-adder-phone.spec.ts` and `full-adder-phone.spec.ts` build both adders with taps. `visual.spec.ts` holds 7 Linux baselines.
- Playwright projects: chromium, firefox, webkit, mobile-chrome, mobile-safari, tablet-safari.

## 8. Left to the builder

- Exact wording of the new strings, in `en` and `es`, in the project's "Label: {count}" form where a count appears.
- How the Wires list orders its rows. Recommendation: by the sink's reading order, as Suggest wires does.
- The pins disclosure's open state: kept per part for the session, or reset on edit. Recommendation: kept.
- Whether the "Wire to…" list groups targets by part.
- How a dialog opened by the canvas overlays (Array) returns focus to a view row (§3.6 rule 2). The acceptance criteria fix the behaviour, not the mechanism.

## 9. Risks

- **Focus return across components.** The Array dialog is hosted by the canvas overlays, not by the view. Its close handler focuses the canvas host. The focus issue must route focus back to the row without breaking the canvas rule (§3.6, rules 2 and 7).
- **Long lists.** A 300-part chip makes a long Parts list. Collapsed pins keep it to one row per part. Measure the model and the render early, in the structure model and view issues.
- **Real screen readers.** Axe and keyboard E2E cannot tell whether the view reads well in VoiceOver or NVDA. A manual pass is a separate issue for the owner (`ready-for-human`).
- **Wire-added wording.** The announcement is not yet payload-bearing. `interaction.ts` is at its import limit, so the change must not add imports there.
