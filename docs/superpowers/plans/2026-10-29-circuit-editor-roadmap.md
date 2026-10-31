# Circuit editor roadmap

**Spec:** `docs/superpowers/specs/2026-10-29-circuit-editor-design.md` (ADRs 0037–0041)
**Builds on:** `feat/strict-template` (PR #1). Each phase is its own plan and its own PR, and each ships a working editor increment.

| Phase | Plan | Ships | Spec sections |
|---|---|---|---|
| 1 | `2026-10-29-editor-phase-1-model-and-engine.md` | **Data model and engine.** Multi-chip projects, saved version + draft, pin IDs and Pins-panel order, bit taps, SPLIT/MERGE built-ins, the new editor actions (no UI yet), save cascade, flattening custom chips and buses into the engine, and the clock (play, pause, step, speed). The demo page keeps working on the new model. | 5.5 (model), 5.6, 5.10, 5.11, §6 projects/actions/simulation |
| 2 | `2026-10-30-editor-phase-2-canvas-interaction.md` | **Canvas interaction.** Pointer-gesture layer (tap, drag, long-press, pinch, two-finger pan), hit-testing with 24 px targets, chip anatomy rendering (pin labels, bus tabs), select/move/delete, Pan/Select toggle, selection box, minimap, keyboard equivalents. | 5.1, 5.3, 5.8 |
| 3 | `2026-10-30-editor-phase-3-wiring.md` | **Wiring.** Tap-tap and drag wiring with an armed state and legal-target highlighting, the orthogonal auto-router, wire animation, moving waypoints on long-press, branches with junction dots, the bit picker. | 5.2, 5.10 (UI) |
| 4 | `…-phase-4-library-and-pins.md` | **Library and pins.** `chip-library` feature: bottom sheet / side panel, search, starred, folders and tags, drag-to-canvas, the quick-add menu, New chip, the Pins panel, placing input/output pins, the save/discard flow with confirmation, breadcrumbs and look-inside. | 5.4, 5.5 (UI), 5.6 (UI), 5.11 |
| 5 | `…-phase-5-bulk-editing.md` | **Bulk editing.** Duplicate, copy and paste, Array, wiring several pins at once, Suggest wires (ghost wires plus accept or dismiss). | 5.7 |
| 6 | `…-phase-6-accessible-editing.md` | **Accessible editing.** The full structural screen-reader view with commands for every action, plus keyboard-only E2E flows covering phases 2–5. Axe across all new UI, and visual baselines updated. | 2.10, ADR 3/21 |

Phases run in order. Phase 1 is planned in detail now. Each later phase gets its own detailed plan once the phase before it is merged, so that plan can work from real code instead of guesses.

Spikes to run at the start of the phase that needs them (spec §8):
- **Phase 2:** gesture disambiguation.
- **Phase 3:** router performance.
- **Phase 4:** React Aria drag-and-drop on Android (RAC #6365).
