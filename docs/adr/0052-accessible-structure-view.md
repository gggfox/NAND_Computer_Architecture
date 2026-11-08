# 52. Accessible structure view (reads the Phase 6 spec §3.1 and §3.4–3.6)

A screen-reader or keyboard-only user can read the circuit and edit it without the canvas. The structure view lists the parts, their pins and the wires. Each row has an Actions menu. Wires are made in a "Wire to…" dialog. This is the work of issue #17. The spec is [the Phase 6 design](../superpowers/specs/2026-11-07-editor-phase-6-accessible-editing-design.md). The plan named this record ADR 51. ADR 51 was already used for the deploys, so this record is ADR 52.

## Where the logic lives

- `circuit-editor/domain/structure.ts`: `structureOf(scene)` is a pure function. It returns the parts, the pins with their connections, and the wires, with display names and stable ids.
- `domain/wire-targets-list.ts`: `wireTargets(scene, from)` lists the legal pins for a wire. It calls `completionFor`, the rule the canvas uses to mark legal targets.
- `domain/interaction-view.ts` (with `view-command-types.ts`): the commands `selectItems`, `connectPins` and `readOutputs`.
- `accessibility/ui/StructureView.tsx` and the rows (`PartRow`, `PinRow`, `WireRow`) replace `CircuitSummary`. The Actions menus are `PartActions`, `PinActions` and `WireActions`. `WireToDialog` is the dialog. `StructureActions`, `AddPartMenu` and `SuggestedList` hold the circuit actions.
- `accessibility/ui/use-row-focus.ts` and `src/shared/focus-return.ts` move focus after a row action.

## Decisions

All were chosen by the owner on 2026-11-07 (§3.1) or are the plan's calls (§3.4–3.6), unless marked.

1. **Layout (owner).** A Parts list and a Wires list. They are plain headings and nested lists. No composite widget (no treegrid), so the view works with every screen reader. A part shows its name, its state and a "Pins" disclosure. A wire is one row, such as `Input A out to NAND gate 1 a`. A bit tap reads `Input D bit 2 to NAND gate 1 a`.
2. **Command surface (owner).** An Actions menu on each part, pin and wire row, named "Actions for {row}". The entries reuse the canvas menus, the existing dialogs and the existing interaction commands. There is no command palette.
3. **Wiring (owner).** A pin menu offers "Wire to…" (output) or "Wire from…" (input). It opens a dialog that lists only legal pins, with a search field and a bit field for buses. The dialog uses the same legality check as the armed state. Focus stays in the dialog until the wire is made.
4. **Placement (owner).** The view stays in the side panel, under the Pins panel, as a region named "Circuit structure". A skip link, "Skip to circuit structure", moves focus to the region heading. Pins are collapsed by default.
5. **The view sends interaction commands, never editor actions (§3.4).** The interaction store announces the result in one live region, and the canvas shows the same selection. Two commands are new. `selectItems` selects exactly the given parts and wires. `connectPins` wires two pin ends as one `connectWire` action, with an optional bit on each. A refused wire announces its reason. Placing a part uses `placeAt` with no point. A part menu action is "select, then act": "Move right" is `selectItems` then `nudge`.
6. **Live-region policy (§3.5).**
   1. Edit results are spoken in the canvas host's polite region only.
   2. The save and discard results stay in the header `<output>`.
   3. Dialog-local text stays in its dialog: the Array size line, and the one-line summary of the "Wire to…" dialog. A refusal in the dialog is `role="alert"`.
   4. Outputs go quiet while the clock plays (`aria-live="off"`). A "Read outputs" button speaks all outputs once. When the clock is paused, an output speaks through its implicit `status` role.
   5. A wire result names both pins: "Wire added: {from} to {to}". Matching `/Wire added/u` still works.
7. **Focus rules (§3.6).**
   1. A menu returns focus to its button when it closes.
   2. A dialog opened from a row returns focus to the menu button of that row. If the row is gone, focus goes to the next row's menu button, then the previous row's, then the section heading.
   3. Delete moves focus in the same way.
   4. "Add part…" moves focus to the menu button of the new part.
   5. A wire made in "Wire to…" returns focus to the menu button of the pin.
   6. The skip link moves focus to the region heading. The headings have `tabIndex={-1}`.
   7. A dialog opened from a canvas menu returns focus to the canvas host. This does not change.
   8. Tab leaves every component. No trap exists outside a modal dialog.
8. **The pins disclosure** is kept per part for the session, in view state. It is not saved and not part of history.
9. **Wire rows** are in the sink's reading order, as Suggest wires orders its proposals.

## Calls made while building

- **Session context.** The three menu tasks needed the `EditorSession`. `StructureView` provides it through `StructureSessionContext`, and a menu reads it with `useStructureSession()`. `createEditorSession` is exported from the `circuit-editor` index for the tests.
- **Bit tap and output labels.** A bit tap reads `bit {n}` (`structure_bit`). An output part reads `Output {name}` (`output_named`).
- **Bus bits in the dialog.** A one-bit source into a bus asks for a bit on the target. A bus source into a one-bit target asks for a bit on the source. Two buses of the same width ask for no bit. A bus end always carries `bit` in its `PinRef`, because `connectPins` does not open the bit picker.
- **The dialog checks the wire with `checkConnection`** before it sends `connectPins`. A refusal (for example a driven input) shows in the dialog, and the dialog stays open. The search field is outside the form, so `Enter` there never submits.
- **"Add part…"** lists the built-in parts only: NAND, Input pin, Output pin, Split 4/8/16, Merge 4/8/16 and Clock. Custom chips stay in the library. Input and output pins use a new `addPinAtCentre` bridge function.
- **The Array dialog** is hosted by the canvas overlays. The part menu sets one focus target in `src/shared/focus-return.ts` after the dialog opens. `useFocusHostOnClose` takes that target, or focuses the canvas host when none is set. The `shared` folder imports no feature.
- **"Read outputs"** moved from the route into `StructureActions`, next to "Suggest wires" and "Tidy wires".
- **Axe found one violation.** The focused skip link covered the "All projects" link (`target-size`, `target-offset`). The focused skip link now sits at the bottom of the viewport, with a 44 px minimum height. No rule was disabled.
- **Keyboard-only E2E.** `activate` waits 3 animation frames before it focuses a control, because the app moves focus by itself two frames after a dialog closes. The "Wire to…" helper presses ArrowDown when no option is current after a search. Both are workarounds and are recorded in issue #85.
- **Visual baselines.** The structure view needs a 1280 × 2600 viewport, because the side panel scrolls. The new baselines are Linux only.
- **Timing.** `structureOf` takes about 8 ms on the 300-part fixture (median 10 runs, range 7.4–14 ms). The budget is 16 ms. `wireTargets` takes 2.7–2.8 ms on the 200-part chip, with 444 targets. `pnpm e2e:perf` p95 was 16.7 ms.

## Follow-ups

- Issue #85: "Wire to…" Enter after a search can pick nothing, a menu button can fail to open while a panel takes focus, and focus moves twice after a row dialog closes.
- Firefox could not start on the machine that built the E2E tasks. Its E2E runs only in CI.
- The owner's manual pass with VoiceOver and NVDA (issue #60) is open. Axe and the keyboard E2E cannot show how the view reads.
- Reading the live values of one instance inside a parent stays out of scope.
