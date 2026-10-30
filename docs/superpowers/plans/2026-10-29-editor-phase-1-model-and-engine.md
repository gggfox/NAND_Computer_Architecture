# Editor Phase 1: Model and Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-root-circuit model with multi-chip projects. This covers saved versions and drafts, stable pin IDs, the Pins-panel order, bit taps, and the SPLIT/MERGE built-ins. It adds every non-UI editor action, the save cascade, flattening of custom chips and buses into the 1-bit engine, and a clock run loop in the worker. The demo page keeps working on the new model.

**Architecture:** The model rules live in `projects/domain` as pure functions that return `Result`: pin resolution, wire legality, containment and the save cascade. The `circuit-editor` reducer turns each `EditorAction` into one of these calls on a chip's draft. `toNetlistSource` flattens the open chip's draft into a `NetlistSource`. It recurses through the *saved* versions of nested chips and expands buses per bit. The `simulation` engine gains one shared clock signal. The session gains play, pause, step and speed. The worker adapter supplies wall-clock time, so the domain stays deterministic. The store keeps input values by `PinId` and tracks the open chip. Saving a chip rewrites every undo snapshot instead of pushing a new one.

**Tech Stack:** TypeScript 7, Zod 4, Zustand (vanilla), Vitest (v8 coverage), Paraglide JS, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-29-circuit-editor-design.md` (§5.5 model, §5.6, §5.10, §5.11, §6), ADRs `docs/adr/0037`–`0041`, roadmap `docs/superpowers/plans/2026-10-29-circuit-editor-roadmap.md` (Phase 1).

## Global Constraints

- The save format is a draft (ADR 33). `version` stays `1`, `defaultChain` stays `[]`, and there is no migration. The committed fixture `src/features/projects/fixtures/v1-demo.json` is rewritten to the new shape.
- `throw` is banned in `src/features/*/domain/**` and in `src/features/simulation/**` outside `adapters/`. Return `Result` (ADR 28).
- Each feature exposes only `index.ts`. `simulation` imports only `~/shared/*`. `shared` imports no feature. No import cycles: `projects` never imports `circuit-editor` (ADR 23).
- Zod is used only at trust boundaries: the project file and IndexedDB reads (`ProjectSchema`), and worker messages (`ToEngineSchema` / `FromEngineSchema`). Domain functions never parse (ADR 27).
- Every error-union case gets a message in both `messages/en.json` and `messages/es.json` (ADR 17/19).
- 95% branch coverage on `src/features/*/domain/**`, `src/features/simulation/**` (excluding `adapters/`) and `src/shared/**` (ADR 32; enforced by `vitest.config.ts`).
- IDs are branded UUIDs (ADR 11). Names are display-only. Wires to custom chips reference `PinId` (ADR 39).
- Bit widths are `1 | 4 | 8 | 16`. SPLIT/MERGE `n` is `4 | 8 | 16` (spec §5.5, §5.10). Bus-to-bus wires need equal width. A bit tap has width 1 (ADR 40).
- Built-in pin numbering is fixed:
  - NAND: `0`=a, `1`=b, `2`=out.
  - Pin piece: `0` (it drives inside the chip if it is an input, and sinks if it is an output).
  - Clock: `0`=out.
  - `split n`: `0`=n-bit in, `k`=1-bit out of bit `k-1` (k = 1..n).
  - `merge n`: `i`=1-bit in for bit `i` (i = 0..n-1), `n`=n-bit out.
- The engine stays 1-bit per signal (spec §5.10). There is exactly one clock signal per netlist.
- Every edit is an `EditorAction` through the reducer (ADR 8). `saveChip` is not pushed on the undo stack (spec §5.11).
- No new UI in this phase. Existing `pnpm e2e` specs (`Input A`, `Input B`, `Output: 1`, `NAND gate 1`, `Add NAND`) must keep passing unchanged.
- knip runs in `pnpm check`. Do not export anything from a non-index module without a consumer.
- Conventional Commits. Every task ends with a commit. Never bypass hooks (ADR 13, 31).

## Review Focus

1. **Saving a chip used two levels deep.** Every *direct* parent drops its wires to removed or width-changed pins, in both its saved version and its draft. Grandparents keep their wiring untouched, but simulate the new behaviour. The effects count each dropped wire once. Owned by Task 3 (`planSave nested`), with simulation pickup in Task 8 (`grandparent simulates the new saved version`).
2. **Self-containment through indirect nesting.** This includes the path through saving. A chip whose draft holds X must not be savable when X's saved version already contains it, and an imported file with a cycle must not hang flattening. Owned by Task 3 (`canPlace` and `planSave` self-containment tests) and Task 8 (`RecursiveChip`).
3. **Bit-tap legality.** Cases: a tap on a 1-bit pin; a tap at `bit >= width`; a tap meeting a whole bus; a whole-pin wire and a tap driving overlapping bits of one input. Owned by Task 2 (`checkConnection bit taps` and `single driver per input bit`).
4. **Reordering pins never rewires.** Reordering the pins of a saved chip, then saving, leaves every parent's wires and flattened netlist identical. Reordering the open chip's own inputs keeps each input's value attached to its pin. Owned by Task 5 (`reorderPin never touches wires`), Task 8 (`reordering a nested chip's pins never rewires`) and Task 9 (`input values follow their pins across reorder`).
5. **Clock determinism under a seed.** A racing latch driven by the clock gives identical state after N steps whether it got there by `step` ×N, by one `advance`, or by many small `advance` calls. A reload while playing keeps playing. Owned by Task 7 (`same seed and step count give the same state regardless of batching`).

---

## Decisions this plan fixes (builder calls, not spec)

- **Pin pieces.** A chip's own input and output pins are `ChipInstance`s of kind `{ type: "pin", pinId }`. The direction and width live on the `PinDef` in `circuit.pins`. Every `PinDef` has exactly one piece; the schema refines this.
- **`circuit.pins` is the Pins-panel list.** Engine numbering is "inputs first, then outputs" (spec §4). `reorderPin` moves a pin within its own direction.
- **Unconnected inputs stay an error** (`UnconnectedPin`), as today, so pins added by a save cascade show up as a clear simulation notice.
- **A clock `step` is one toggle (half cycle) followed by a settle.** Speed is in steps per second: `MIN 0.5`, `MAX 1000`, `DEFAULT 4`. The worker batches every `16 ms`, runs at most `64` steps per batch, and drops any excess.
- **Saving rewrites history.** `saveChip` applies `applySavedVersion` to every snapshot in `past`, `present` and `future`. Saved versions are therefore identical across the whole undo history, and undo never reverts a save.
- **`lastOpenedChipId`.** The store tracks the open chip as `chipId`. Autosave writes `{ ...present, lastOpenedChipId: chipId }`, so undo snapshots never need it.

## File Structure

```
src/shared/ids.ts                                   + FolderIdSchema
src/features/projects/domain/
  model.ts            schemas: PinDef, PinRef(+bit), InstanceKind (nand|clock|split|merge|pin|custom), Wire(+manualWaypoints), Circuit(+pins), Chip(saved?/draft), Project(chips, lastOpenedChipId)
  builders.ts   NEW   pinDef, piece, pinPiece, wire, newChip, projectWith, EMPTY_CIRCUIT, DEFAULT_CHIP_COLOR
  chips.ts      NEW   findChip, replaceChip, chipsUsing
  pins.ts       NEW   endpointInfo (role + width of any pin of any instance)
  wiring.ts     NEW   checkConnection, findInvalidWire, ConnectionError
  containment.ts NEW  containsChip, canPlace, PlaceError
  save-cascade.ts NEW planSave, applySavedVersion, SaveEffect, SavePlan, SaveError
  demo.ts             demo = one draft-only chip
src/features/projects/fixtures/v1-demo.json         rewritten
src/features/circuit-editor/domain/
  actions.ts          EditorAction / EditorError (all cases)
  reducer.ts          applyAction switch + editorErrorMessage
  circuit-edits.ts NEW place/move/remove/connect/removeWire/moveWaypoint
  pin-edits.ts   NEW  addPin/removePin/renamePin/setPinWidth/reorderPin
  chip-edits.ts  NEW  createChip/renameChip/recolorChip/saveChip/discardDraft
  history.ts          + mapHistory
  io-layout.ts   NEW  ioLayout, packInputs, unpackOutputs
  to-netlist-source.ts rewritten: flatten (project, chipId)
  geometry.ts, signals.ts, messages.ts   adapted
src/features/circuit-editor/application/{editor-store,simulation-bridge}.ts   chipId, inputs by PinId, save rebase, clock controls
src/features/simulation/domain/
  netlist.ts          + clock SignalRef, layout [inputs…, clock, nands…]
  engine.ts           + setClock
  clock.ts       NEW  speed constants, stepsDue
  protocol.ts         + play/pause/step/setSpeed, state.clock/running
  session.ts          + run state, advance(elapsedMs)
src/features/simulation/adapters/engine.worker.ts   batch timer
UI adapted (no new UI): circuit-editor/ui/{EditorToolbar,CircuitCanvas,use-editor-session}.tsx, adapters/canvas-renderer.ts, accessibility/ui/CircuitSummary.tsx
messages/en.json, messages/es.json, GLOSSARY.md
```

---

### Task 1: Multi-chip project model, builders, demo and fixture

**Files:**
- Modify: `src/shared/ids.ts` (add `FolderIdSchema = z.uuid().brand<"FolderId">()`)
- Modify: `src/features/projects/domain/model.ts`, `src/features/projects/domain/demo.ts`, `src/features/projects/index.ts`
- Create: `src/features/projects/domain/builders.ts`, `src/features/projects/domain/chips.ts`
- Rewrite: `src/features/projects/fixtures/v1-demo.json`
- Test: `src/features/projects/domain/format.test.ts`, `src/features/projects/domain/chips.test.ts` (new)
- Mechanical updates so the repo stays green: `src/features/circuit-editor/domain/{reducer,to-netlist-source,signals,geometry}.ts` and their tests; `application/{editor-store,simulation-bridge}.ts` and their tests; `ui/{EditorToolbar,CircuitCanvas}.tsx`; `adapters/canvas-renderer.ts`; `src/features/accessibility/ui/CircuitSummary.tsx`; `src/features/persistence/**/*.test.ts` (only if they touch `rootCircuit`)
- Modify: `GLOSSARY.md`

**Interfaces:**
- Produces (`~/features/projects`):
  - `type BitWidth = 1 | 4 | 8 | 16`, `type BusWidth = 4 | 8 | 16`, `type PinDirection = "input" | "output"`
  - `interface PinDef { id: PinId; name: string; width: BitWidth; direction: PinDirection }`
  - `type PinKey = number | PinId`. `interface PinRef { instanceId: InstanceId; pin: PinKey; bit?: number }` (`bit` is 0..15)
  - `type InstanceKind = {type:"nand"} | {type:"clock"} | {type:"split"; width: BusWidth} | {type:"merge"; width: BusWidth} | {type:"pin"; pinId: PinId} | {type:"custom"; chipId: ChipId}`
  - `ChipInstance { id; kind: InstanceKind; position: Point; label?: string }`
  - `Wire { id; from: PinRef; to: PinRef; bitWidth: BitWidth; waypoints: readonly Point[]; manualWaypoints: boolean }`
  - `Circuit { pins: readonly PinDef[]; instances; wires }`
  - `Chip { id; name; color; saved?: Circuit; draft: Circuit; folderId?: FolderId; tags: readonly string[] }`
  - `Folder { id: FolderId; name }`
  - `Project { id; name; seed; chips: readonly Chip[]; lastOpenedChipId: ChipId; folders: readonly Folder[] }`
  - `isHexColor(color: string): boolean`
  - builders: `DEFAULT_CHIP_COLOR = "#3b82f6"`, `EMPTY_CIRCUIT: Circuit`, `pinDef(name, direction, width = 1): PinDef`, `piece(kind, position = {x:0,y:0}): ChipInstance`, `pinPiece(def, position?): ChipInstance`, `wire(from, to, bitWidth = 1): Wire` (waypoints `[]`, `manualWaypoints: false`), `newChip(name, draft = EMPTY_CIRCUIT, options?: { saved?: boolean; color?: string }): Chip` (`saved: true` sets `saved = draft`), `projectWith(name, chips: readonly [Chip, ...Chip[]], seed = 1): Project` (opens the first chip, `folders: []`)
  - chips: `findChip(project, chipId): Chip | undefined`, `replaceChip(project, chip): Project` (by id; unchanged if the chip is absent), `chipsUsing(project, chipId): readonly Chip[]` (chips whose saved version or draft has a `custom` instance of `chipId`)
- Produces (`~/features/circuit-editor`): `openCircuit(state: EditorState): Circuit`, which returns the draft of `state.chipId`, or `EMPTY_CIRCUIT` if that chip is missing. `EditorState.chipId: ChipId` is initialised from `project.lastOpenedChipId`.
- Produces: `partOf(circuit: Circuit, instance: ChipInstance): Part`, where `type Part = "nand" | "clock" | "split" | "merge" | "custom" | "input" | "output"` (a pin piece maps to its def's direction).
- Removed: `BuiltinKind`, `Project.rootCircuit`.

- [ ] **Step 1: Write the failing tests** in `format.test.ts`. Replace the `rootCircuit` / `bitWidth 0` tests. Keep the round-trip, fixture, limits, stored and migration tests as they are.

```ts
test("the demo is one draft-only chip the project opens on", () => {
  const project = createDemoProject("Demo");
  const [chip] = project.chips;
  expect(project.chips).toHaveLength(1);
  expect(chip?.saved).toBeUndefined();
  expect(project.lastOpenedChipId).toBe(chip?.id);
  expect(chip?.draft.pins.map((p) => [p.name, p.direction, p.width])).toEqual([
    ["A", "input", 1], ["B", "input", 1], ["OUT", "output", 1],
  ]);
  expect(chip?.draft.instances.map((i) => i.kind.type)).toEqual(["pin", "pin", "nand", "pin"]);
  expect(chip?.draft.wires.every((w) => !w.manualWaypoints)).toBe(true);
});
test.each([
  ["lastOpenedChipId names no chip", (p) => ({ ...p, lastOpenedChipId: newChipId() })],
  ["no chips", (p) => ({ ...p, chips: [] })],
  ["a pin piece without a definition", dropFirstPinDef],
  ["a pin definition with two pieces", duplicateFirstPinPiece],
  ["split width 2", withFirstInstanceKind({ type: "split", width: 2 })],
  ["a bit index of 16", withFirstWireFromBit(16)],
  ["wire bitWidth 3", withFirstWireWidth(3)],
  ["color 'red'", withChipColor("red")],
])("%s is InvalidProject", (_name, corrupt) => {
  const result = parseProjectFile(envelope(1, corrupt(createDemoProject("x"))));
  expect(!result.ok && result.error.type).toBe("InvalidProject");
});
```

`chips.test.ts`:

```ts
test("findChip finds by id and misses unknown ids", ...)        // toBe(chip) / toBeUndefined()
test("replaceChip swaps by id and ignores unknown chips", ...)   // other chips toBe same refs; unknown → toBe(project)
test("chipsUsing finds parents through saved versions and drafts", ...) // [savedParent, draftParent], not grandparent
```

- [ ] **Step 2: Run them and confirm they fail.** Run `pnpm vitest run src/features/projects`. Expected: FAIL (`chips` is undefined on the demo; `./chips` does not exist).

- [ ] **Step 3: Implement the schemas in `model.ts`.**
  - Key order is the serialized order: Project `id, name, seed, chips, lastOpenedChipId, folders`; Chip `id, name, color, saved, draft, folderId, tags`; Circuit `pins, instances, wires`; PinDef `id, name, width, direction`; Wire `id, from, to, bitWidth, waypoints, manualWaypoints`; PinRef `instanceId, pin, bit`.
  - `InstanceKindSchema` is a `z.discriminatedUnion("type", …)`. `PinRef.pin` is `z.union([z.number().int().nonnegative(), PinIdSchema])`.
  - Use `.superRefine` on Circuit (each pin piece references a def in `pins`; each def has exactly one piece) and on Project (`chips.min(1)`, unique chip ids, `lastOpenedChipId` present).
  - `isHexColor` reuses the existing `HEX_COLOR` regex.

- [ ] **Step 4: Implement `builders.ts`, `chips.ts` and `createDemoProject`.** Build the demo with the builders: pins A, B, OUT; pieces at the old positions (0,0), (0,80), NAND (160,40), OUT (320,40); three wires as before. Use `projectWith(name, [newChip(name, draft)], randomSeed())`. Export everything listed under Interfaces from `index.ts`.

- [ ] **Step 5: Rewrite the fixture** with ids `…001` project, `…009` chip, `…00a/…00b/…00c` pins A/B/OUT, `…002/…003/…005` pieces A/B/OUT, `…004` NAND, `…006/…007/…008` wires (prefix `00000000-0000-4000-8000-000000000`), name `"Demo"` for both project and chip, seed `123456789`, color `#3b82f6`. Write it exactly as `serializeProject` prints it: 2-space indent and a trailing newline.

- [ ] **Step 6: Make the mechanical consumer updates.** Behaviour must not change.
  - Replace `kind.type === "builtin" ? kind.builtin : "custom"` with `partOf(circuit, instance)`.
  - Replace `project.rootCircuit` with the open chip's draft: `openCircuit(state)` in the UI and bridge; in the reducer, `findChip(project, project.lastOpenedChipId)` plus `replaceChip`.
  - The reducer's `isProtected` becomes `kind.type === "pin"`.
  - In `to-netlist-source.ts`, input/output come from pin-piece direction. Everything except `nand` and pin pieces stays `UnsupportedPart`.
  - `countInputs` counts input pin pieces.
  - Tests build circuits with the builders instead of `{ type: "builtin", builtin: … }`.

- [ ] **Step 7: Add the glossary entries.** **Pin piece**: the canvas piece of one of the chip's own input or output pins. **Step (clock)**: one toggle of the clock followed by a settle.

- [ ] **Step 8: Verify.** Run `pnpm typecheck && pnpm lint && pnpm test && pnpm knip`. Expected: all pass, coverage thresholds met.

- [ ] **Step 9: Commit**

```bash
git add -A src/shared/ids.ts src/features GLOSSARY.md
git commit -m "feat(projects): multi-chip projects with saved version, draft and pin definitions"
```

---

### Task 2: Pin resolution and wire legality

**Files:**
- Create: `src/features/projects/domain/pins.ts`, `src/features/projects/domain/wiring.ts`
- Test: `src/features/projects/domain/pins.test.ts`, `src/features/projects/domain/wiring.test.ts`
- Modify: `src/features/projects/index.ts`

**Interfaces:**
- Consumes: Task 1 model, builders and `findChip`.
- Produces:
  - `type PinRole = "source" | "sink"`. `interface EndpointInfo { role: PinRole; width: BitWidth }`
  - `endpointInfo(project: Project, circuit: Circuit, instance: ChipInstance, pin: PinKey): EndpointInfo | undefined`. Built-ins use the numbering from Global Constraints. A `custom` instance looks up `PinId` in the chip's **saved** pins (input def → sink, output def → source); there are no pins if the chip is unsaved or missing. A pin piece is a source for an input def and a sink for an output def; there are no pins if the def is missing.
  - `type ConnectionError = {type:"InvalidEndpoint"; instanceId; pin: PinKey} | {type:"BitOutOfRange"; bit: number; width: number} | {type:"WidthMismatch"; from: number; to: number} | {type:"OutputToOutput"} | {type:"InputToInput"} | {type:"InputAlreadyDriven"; instanceId}`
  - `interface Connection { from: PinRef; to: PinRef; bitWidth: BitWidth }` (`from` is the source)
  - `checkConnection(project, circuit, first: PinRef, second: PinRef, ignoreWireId?: WireId): Result<Connection, ConnectionError>`
  - `findInvalidWire(project, circuit): Wire | undefined`. Each stored wire must re-check `ok`, with the same `from`/`to` orientation and the same `bitWidth`.

Test scenario (local helper `scenario()` in each test file): one draft containing:
- pieces `A` (input, 1 bit), `B` (input, 1), `D` (input, 4), `E` (input, 8), `Y` (output, 1), `Q` (output, 4);
- `N` (nand), `S` (split 4), `M` (merge 8), `K` (clock);
- `X`, a custom instance of a saved chip `NOT` with pins `a` (input) and `y` (output);
- `U`, a custom instance of a draft-only chip.

- [ ] **Step 1: Write the failing tests**

```ts
// pins.test.ts
test("NAND: 0 and 1 are 1-bit sinks, 2 a 1-bit source, 3 nothing")   // {role:"sink",width:1}, {role:"source",width:1}, undefined
test("pin pieces: an input drives its width, an output sinks it")   // D,0 → {source,4}; Q,0 → {sink,4}; D,1 → undefined
test("split 4: 0 is a 4-bit sink, 1..4 are 1-bit sources, 5 nothing")
test("merge 8: 0..7 are 1-bit sinks, 8 is the 8-bit source")
test("clock: 0 is a 1-bit source")
test("custom pins are PinIds of the saved version")                 // X,a → sink; X,y → source; X,0 → undefined; a draft-only PinId → undefined
test("a draft-only chip and a dangling pin piece have no pins")      // U → undefined; piece with unknown def → undefined
// wiring.test.ts
test("orders ends source → sink and derives the width")
  // checkConnection(p, c, {N,0}, {A,0}) → ok({ from:{A,0}, to:{N,0}, bitWidth:1 })
test("bus to bus needs equal width")
  // D→Q ok bitWidth 4; E→Q err {type:"WidthMismatch", from:8, to:4}
describe("checkConnection bit taps", () => {                         // Review Focus 3
  test("a tap reaches one bit of a bus from a 1-bit pin")            // {D,0,bit:2}→{N,0} ok, bitWidth 1, from.bit 2
  test("a tap on a 1-bit pin is BitOutOfRange")                      // {A,0,bit:0} → {type:"BitOutOfRange", bit:0, width:1}
  test("a tap past the width is BitOutOfRange")                      // {D,0,bit:4} → {bit:4, width:4}
  test("a tap cannot meet a whole bus")                              // {D,0,bit:1}→{Q,0} → {WidthMismatch, from:1, to:4}
  test("tap to tap is a 1-bit wire")                                 // {D,0,bit:0}→{Q,0,bit:3} ok bitWidth 1
});
test("two outputs cannot be joined")                                 // {N,2},{A,0} → {type:"OutputToOutput"}
test("two inputs cannot be joined")                                  // {N,0},{Y,0} → {type:"InputToInput"}
test("unknown instance or pin is InvalidEndpoint")
describe("single driver per input bit", () => {                      // Review Focus 3
  test("a second wire to a 1-bit input is InputAlreadyDriven")       // A→N0 exists; B→N0 → {InputAlreadyDriven, instanceId:N}
  test("a tap onto a bus already driven whole is rejected")          // D→Q exists; A→{Q,bit:1} → InputAlreadyDriven
  test("taps on different bits coexist; a whole wire over a tap does not") // A→{Q,1}, B→{Q,2} ok; D→Q → InputAlreadyDriven
  test("ignoreWireId skips the wire being re-checked")
});
test("an output may feed several inputs")                            // A→N0 exists; A→N1 ok
test("findInvalidWire: none in the demo, catches backwards and wrong-width wires")
```

- [ ] **Step 2: Run them and confirm they fail.** Run `pnpm vitest run src/features/projects/domain/pins.test.ts src/features/projects/domain/wiring.test.ts`. Expected: FAIL (modules missing).

- [ ] **Step 3: Implement `endpointInfo` and `checkConnection`.** Check in this order:
  1. Both endpoints resolve (`InvalidEndpoint`).
  2. Each `bit` is valid: the pin width must be greater than 1 and `0 <= bit < width` (`BitOutOfRange`).
  3. Roles (`OutputToOutput` / `InputToInput`); swap so `from` is the source.
  4. Effective widths, where a tap counts as 1, are equal (`WidthMismatch`).
  5. No other wire (except `ignoreWireId`) sinks into the same instance+pin with overlapping bits. Overlap means either side is whole-pin or the bits are equal (`InputAlreadyDriven`).

- [ ] **Step 4: Run the tests and confirm they pass.** Same command. Expected: PASS, and `wiring.ts`/`pins.ts` branches ≥ 95%.

- [ ] **Step 5: Commit**

```bash
git add src/features/projects
git commit -m "feat(projects): pin resolution and wire legality with bit taps"
```

---

### Task 3: Containment and the save cascade

**Files:**
- Create: `src/features/projects/domain/containment.ts`, `src/features/projects/domain/save-cascade.ts`
- Test: `src/features/projects/domain/containment.test.ts`, `src/features/projects/domain/save-cascade.test.ts`
- Modify: `src/features/projects/index.ts`

**Interfaces:**
- Consumes: `findChip`, `replaceChip`, `chipsUsing` (Task 1).
- Produces:
  - `containsChip(project, outer: ChipId, target: ChipId): boolean`. True when `outer`'s **saved** version places `target` directly or through other saved versions. Uses a visited set, so it terminates on cyclic files. `containsChip(p, A, A)` is true only when A's saved graph reaches A.
  - `type PlaceError = {type:"ChipNotFound"; chipId} | {type:"ChipNotSaved"; chipId} | {type:"WouldContainItself"; chipId}`
  - `canPlace(project, host: ChipId, placed: ChipId): Result<void, PlaceError>`. Fails if either chip is missing, if `placed` has no saved version, or if `placed === host || containsChip(project, placed, host)`.
  - `type SaveEffect = {type:"PinRemoved"; pinId; name} | {type:"PinAdded"; pinId; name} | {type:"PinRenamed"; pinId; from: string; to: string} | {type:"PinWidthChanged"; pinId; name; from: BitWidth; to: BitWidth} | {type:"WiresRemoved"; chipId: ChipId; count: number}`
  - `interface SavePlan { project: Project; effects: readonly SaveEffect[] }`. `type SaveError = {type:"ChipNotFound"; chipId} | {type:"WouldContainItself"; chipId}`
  - `planSave(project, chipId): Result<SavePlan, SaveError>`. Fails with `WouldContainItself` (carrying the offending instance's chip) when any `custom` instance X in the draft satisfies `X === chipId || containsChip(project, X, chipId)`.
  - `applySavedVersion(project, chipId, saved: Circuit): Project`. Sets `chip.saved = saved`. For every chip in `chipsUsing`, it drops wires in both `saved` and `draft` whose endpoint is an instance of `chipId` on a pin that was removed or changed width relative to the previous saved pins. Returns `project` unchanged if the chip is missing.
  - Effects order: removed, renamed and width-changed pins in old pin order; then added pins in new order; then `WiresRemoved` per parent in `project.chips` order. `count` is the number of distinct `WireId`s dropped across the parent's saved version and draft. Parents with no dropped wires get no effect.

Test scenario `nested()` (local helper):
- Chip `X`, saved pins `a`, `b` (inputs) and `y` (output), saved = draft.
- Chip `P` has instance `x1` of X in both saved and draft. Wires `wa` → `x1.a`, `wb` → `x1.b` and `wy` from `x1.y` use the same ids in both versions.
- Chip `G` holds an instance of P with its own wires.
- `variant(edit)` returns the project with X's draft edited.

- [ ] **Step 1: Write the failing tests**

```ts
// containment.test.ts
test("a chip contains what its saved version places, transitively")  // C⊃B⊃A: containsChip(C,A) true; containsChip(A,C) false
test("drafts do not count")                                          // B.draft holds C, B.saved does not → false
test("a cyclic file terminates")                                     // A.saved⊃B, B.saved⊃A: containsChip(A,A) true; containsChip(A, unrelated) false
describe("canPlace self-containment", () => {                        // Review Focus 2
  test("a draft-only chip cannot be placed")      // {type:"ChipNotSaved", chipId}
  test("a chip cannot be placed in itself")       // canPlace(p, A, A) → {type:"WouldContainItself", chipId:A}
  test("nor in a chip it contains indirectly")    // C⊃B⊃A: canPlace(p, A, C) → WouldContainItself {chipId:C}
  test("unknown chips are ChipNotFound")
});
// save-cascade.test.ts
test("saving promotes the draft")                // plan.project X.saved toEqual X.draft; effects []
describe("planSave nested", () => {              // Review Focus 1
  test("a removed pin drops its wires in the parent's saved version and draft")
    // remove b: P.saved.wires and P.draft.wires have no `wb`; effects toEqual
    // [{type:"PinRemoved", pinId:b, name:"b"}, {type:"WiresRemoved", chipId:P, count:1}]
  test("a width change drops wires to that pin")  // b → 4: `wb` gone; effect PinWidthChanged {from:1, to:4}
  test("a renamed pin keeps every wire")          // a → "in": P toBe same Chip object; effect {PinRenamed, from:"a", to:"in"}
  test("an added pin is listed and left unconnected") // effect {PinAdded,...}; P unchanged
  test("grandparents keep their wiring")          // G toBe the same Chip object after removing b
});
test("first save of a draft-only chip lists PinAdded only and touches no chip but itself")
test("saving a draft that would contain itself is WouldContainItself")  // Review Focus 2
  // X.saved ⊃ Y; Y.draft ⊃ X → planSave(p, Y) → {type:"WouldContainItself", chipId:X}
test("unknown chip is ChipNotFound")
test("planSave's project equals applySavedVersion with the draft")
test("applySavedVersion on a missing chip returns the project unchanged")   // toBe(project)
```

- [ ] **Step 2: Run them and confirm they fail.** Run `pnpm vitest run src/features/projects/domain/containment.test.ts src/features/projects/domain/save-cascade.test.ts`. Expected: FAIL (modules missing).

- [ ] **Step 3: Implement.** `containsChip` is an iterative DFS over saved versions with a `Set<ChipId>`. `planSave` does the containment check, then computes the pin diff by `PinId` between `chip.saved?.pins ?? []` and `chip.draft.pins`, then calls `applySavedVersion`.

- [ ] **Step 4: Run the tests and confirm they pass.** Same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/projects
git commit -m "feat(projects): containment rules and the save cascade with effects"
```

---

### Task 4: Editor actions for instances and wires (chip-scoped, no ProtectedInstance)

**Files:**
- Modify: `src/features/circuit-editor/domain/actions.ts`, `src/features/circuit-editor/domain/reducer.ts`, `src/features/circuit-editor/domain/messages.ts`
- Create: `src/features/circuit-editor/domain/circuit-edits.ts`
- Test: `src/features/circuit-editor/domain/circuit-edits.test.ts` (new), `reducer.test.ts`, `messages.test.ts`
- Modify callers: `ui/EditorToolbar.tsx` (pass `chipId: editor.getState().chipId`); `application/editor-store.test.ts`, `simulation-bridge.test.ts` (actions gain `chipId`)
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: `canPlace`, `checkConnection`, `findChip`, `replaceChip` (Tasks 1–3).
- Produces:
  - `type PlaceableInstance = ChipInstance & { kind: Exclude<InstanceKind, { type: "pin" }> }`
  - `EditorAction` variants:
    - `{type:"placeChip"; chipId; instance: PlaceableInstance}`
    - `{type:"moveChip"; chipId; instanceId; position}`
    - `{type:"removeChip"; chipId; instanceId}`
    - `{type:"connectWire"; chipId; wireId: WireId; from: PinRef; to: PinRef}`
    - `{type:"removeWire"; chipId; wireId}`
    - `{type:"moveWaypoint"; chipId; wireId; waypoints: readonly Point[]}`
  - `EditorError` cases: `InstanceNotFound {instanceId}`, `DuplicateInstance {instanceId}`, `| PlaceError | ConnectionError |`, `WireNotFound {wireId}`, `DuplicateWire {wireId}`. `ProtectedInstance` is removed.
  - `circuit-edits.ts`: one function per action, each `(project: Project, action: Extract<EditorAction, {type: …}>) => Result<Project, EditorError>`, plus `editDraft(project, chipId, edit: (circuit: Circuit) => Result<Circuit, EditorError>): Result<Project, EditorError>` (`ChipNotFound` if the chip is missing). Only the named chip's **draft** changes.
  - `removeChip` on a pin piece also removes that piece's `PinDef`.

Messages to add. Keep `editor_error_instance_not_found` and `editor_error_duplicate_instance`; delete `editor_error_protected_instance`.

| key | en | es |
|---|---|---|
| `editor_error_chip_not_found` | Chip {chipId} was not found. | No se encontró el chip {chipId}. |
| `editor_error_chip_not_saved` | Save this chip before placing it in another chip. | Guarda este chip antes de colocarlo dentro de otro. |
| `editor_error_would_contain_itself` | A chip can't contain itself, directly or through another chip. | Un chip no puede contenerse a sí mismo, ni directamente ni a través de otro chip. |
| `editor_error_invalid_endpoint` | That pin does not exist on this chip. | Ese pin no existe en este chip. |
| `editor_error_bit_out_of_range` | Bit {bit} does not exist on a {width}-bit pin. | El bit {bit} no existe en un pin de {width} bits. |
| `editor_error_width_mismatch` | A {from}-bit pin can't be wired to a {to}-bit pin. | Un pin de {from} bits no se puede conectar a uno de {to} bits. |
| `editor_error_output_to_output` | Two outputs can't be wired together. | No se pueden conectar dos salidas entre sí. |
| `editor_error_input_to_input` | Wire an output to an input; two inputs can't be joined. | Conecta una salida a una entrada; dos entradas no se pueden unir. |
| `editor_error_input_already_driven` | That input already has a wire. | Esa entrada ya tiene un cable. |
| `editor_error_wire_not_found` | Wire {wireId} was not found. | No se encontró el cable {wireId}. |
| `editor_error_duplicate_wire` | Wire {wireId} already exists. | El cable {wireId} ya existe. |

- [ ] **Step 1: Write the failing tests** in `circuit-edits.test.ts`. Use a local `twoChips()` helper: a demo chip `H` (open) and a saved chip `NOT`, built with the builders.

```ts
test("placeChip changes only the named chip's draft")     // H.draft.instances +1; H.saved, NOT toBe unchanged
test("placeChip of a draft-only chip is ChipNotSaved")
test("placeChip of a chip into itself is WouldContainItself")
test("placeChip into an unknown chip is ChipNotFound")
test("moveChip moves; an unknown instance is InstanceNotFound")
test("removeChip removes the instance and its wires")      // NAND: instances 3, wires 0
test("removing a pin piece removes its definition")        // remove A piece: pins names ["B","OUT"], wires 2
test("connectWire stores source → sink, derived width, auto-routed")
  // connectWire(from {N,0}, to {A,0}) → wire {from:{A,0}, to:{N,0}, bitWidth:1, waypoints:[], manualWaypoints:false}
test("connectWire returns the connection error")           // → {type:"OutputToOutput"}
test("connectWire with an existing wire id is DuplicateWire")
test("removeWire removes; unknown is WireNotFound")
test("moveWaypoint stores bends and marks them manual")    // waypoints [{x:40,y:0}], manualWaypoints true
test("moveWaypoint with no bends hands the wire back to the router") // manualWaypoints false
test("every edit leaves its input project unchanged")      // structuredClone before, toEqual after
```

Update `messages.test.ts`: the list of `EditorError` cases equals every case above, and `new Set(messages).size === cases.length`.

- [ ] **Step 2: Run them and confirm they fail.** Run `pnpm vitest run src/features/circuit-editor/domain`. Expected: FAIL (no `connectWire`; missing `chipId`).

- [ ] **Step 3: Implement** `circuit-edits.ts`, the new `actions.ts` unions, the `applyAction` switch, and the `editorErrorMessage` cases. Change `editorStoreErrorMessage` to delegate with a `isPersistenceError(error)` guard over `"NotFound" | "Corrupt" | "QuotaExceeded" | "Unavailable"` instead of listing editor cases. Add the message keys to both JSON files.

- [ ] **Step 4: Verify.** Run `pnpm typecheck && pnpm vitest run src/features/circuit-editor`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/circuit-editor messages
git commit -m "feat(circuit-editor): chip-scoped place, move, remove, wire and waypoint actions"
```

---

### Task 5: Editor actions for pins and chips, saving and discarding

**Files:**
- Create: `src/features/circuit-editor/domain/pin-edits.ts`, `src/features/circuit-editor/domain/chip-edits.ts`
- Modify: `actions.ts`, `reducer.ts`, `history.ts`, `messages/en.json`, `messages/es.json`
- Test: `pin-edits.test.ts`, `chip-edits.test.ts` (new), `history.test.ts`, `messages.test.ts`

**Interfaces:**
- Consumes: `editDraft` (Task 4), `checkConnection` (Task 2), `planSave` and `SaveError` (Task 3), `isHexColor`, `EMPTY_CIRCUIT` (Task 1).
- Produces `EditorAction` variants:
  - `{type:"addPin"; chipId; pin: PinDef; instanceId: InstanceId; position: Point}`. Inserts the pin after the last pin of its direction and adds `pinPiece`.
  - `{type:"removePin"; chipId; pinId}`. Removes the def, its piece and that piece's wires.
  - `{type:"renamePin"; chipId; pinId; name}`. Changes the name only; it is trimmed, and empty is rejected.
  - `{type:"setPinWidth"; chipId; pinId; width: BitWidth}`. Drops each wire on the piece that fails `checkConnection` after the change.
  - `{type:"reorderPin"; chipId; pinId; toIndex: number}`. `toIndex` is a position among pins of the same direction, valid from 0 to count-1. Only `pins` changes.
  - `{type:"createChip"; chipId; name; color}`. Adds `{ id, name, color, draft: EMPTY_CIRCUIT, tags: [] }` with no `saved`.
  - `{type:"renameChip"; chipId; name}`, `{type:"recolorChip"; chipId; color}`.
  - `{type:"saveChip"; chipId}`. Returns `planSave(...).project`.
  - `{type:"discardDraft"; chipId}`. Sets `draft = saved`; `ChipNotSaved` when there is no saved version.
- New `EditorError` cases: `PinNotFound {pinId}`, `DuplicatePin {pinId}`, `PinIndexOutOfRange {index}`, `DuplicateChip {chipId}`, `EmptyName`, `InvalidColor {color}` (all of `SaveError` is already covered).
- `history.ts`: `mapHistory<S>(history: History<S>, fn: (snapshot: S) => S): History<S>`.

Messages:

| key | en | es |
|---|---|---|
| `editor_error_pin_not_found` | Pin {pinId} was not found. | No se encontró el pin {pinId}. |
| `editor_error_duplicate_pin` | Pin {pinId} already exists. | El pin {pinId} ya existe. |
| `editor_error_pin_index_out_of_range` | Position {index} is outside the pin list. | La posición {index} está fuera de la lista de pines. |
| `editor_error_duplicate_chip` | Chip {chipId} already exists. | El chip {chipId} ya existe. |
| `editor_error_empty_name` | A name can't be empty. | El nombre no puede estar vacío. |
| `editor_error_invalid_color` | {color} is not a colour in #rrggbb form. | {color} no es un color con formato #rrggbb. |

- [ ] **Step 1: Write the failing tests**

```ts
// pin-edits.test.ts (demo chip: pins A, B, OUT)
test("addPin puts an input after the last input, with its piece")   // names ["A","B","C","OUT"]; piece kind {type:"pin", pinId:C}
test("addPin puts an output last")                                  // ["A","B","OUT","OUT2"]
test("addPin with an existing pin id is DuplicatePin")
test("removePin removes the definition, its piece and its wires")   // pins 2, instances 3, wires 2
test("renamePin changes only the name")                             // wires and ids toEqual before
test("renamePin to blanks is EmptyName")                            // "  " → {type:"EmptyName"}
test("setPinWidth drops wires that no longer fit and keeps the rest") // A → 4: wire A→N0 gone, others kept
test("narrowing a bus to 1 bit drops its bit taps")                 // D(4) taps bit 3→N0, bit 1→N1; width 1 → both gone
describe("reorderPin never touches wires", () => {                  // Review Focus 4
  test("moves within its direction only")       // B to 0 → ["B","A","OUT"]; wires and instances toBe before
  test("an index outside the direction is PinIndexOutOfRange") // A to 2 → {type:"PinIndexOutOfRange", index:2}
});
test("unknown pin is PinNotFound for remove, rename, width and reorder")
// chip-edits.test.ts
test("createChip adds a draft-only empty chip")     // saved undefined; draft toEqual EMPTY_CIRCUIT; tags []
test("createChip rejects a duplicate id, an empty name and 'red'") // DuplicateChip / EmptyName / InvalidColor {color:"red"}
test("renameChip and recolorChip change one field")  // recolor "#12345" → InvalidColor
test("saveChip equals planSave's project")
test("saveChip passes WouldContainItself through")
test("discardDraft restores the saved circuit as the draft")
test("discardDraft on a draft-only chip is ChipNotSaved")
// history.test.ts
test("mapHistory maps past, present and future")     // {past:[1],present:2,future:[3]} ×10 → {past:[10],present:20,future:[30]}
```

- [ ] **Step 2: Run them and confirm they fail.** Run `pnpm vitest run src/features/circuit-editor/domain`. Expected: FAIL.

- [ ] **Step 3: Implement** `pin-edits.ts` (`removePin` reuses Task 4's pin-piece removal), `chip-edits.ts`, `mapHistory`, the switch cases and the messages.

- [ ] **Step 4: Run the tests and confirm they pass.** Same command. Expected: PASS, domain branches ≥ 95%.

- [ ] **Step 5: Commit**

```bash
git add src/features/circuit-editor messages
git commit -m "feat(circuit-editor): pin, chip, save and discard-draft actions"
```

---

### Task 6: Clock signal in the netlist and engine

**Files:**
- Modify: `src/features/simulation/domain/netlist.ts`, `src/features/simulation/domain/engine.ts`
- Test: `netlist.test.ts`, `engine.test.ts`

**Interfaces:**
- Produces:
  - `SignalRef` gains `{ kind: "clock" }`.
  - The signal layout becomes `[inputs…, clock, nand outputs…]`: clock index = `inputCount`, NAND `i` = `inputCount + 1 + i`.
  - `Engine.setClock(value: 0 | 1): void`. The clock starts at 0 and is untouched by `tick`.

- [ ] **Step 1: Write the failing tests**

```ts
test("the clock is the signal right after the inputs")
  // compile {inputCount:2, nands:[{a:{kind:"clock"}, b:{kind:"nand",index:0}}], outputs:[{kind:"nand",index:0}]}
  // → [...nandA] toEqual [2]; [...nandB] toEqual [3]; [...outputs] toEqual [3]
test("the clock starts low and setClock drives it")
  // NAND(clock, clock): runUntilStable(10) → readOutput(0) 1; setClock(1); runUntilStable(10) → 0
```

Update the existing index assertions that shift by +1 (for example `[...nandA]` for nand refs).

- [ ] **Step 2: Run them and confirm they fail.** Run `pnpm vitest run src/features/simulation/domain/netlist.test.ts src/features/simulation/domain/engine.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** Extend `signalIndexer` for `clock`, allocate `inputCount + 1 + nandCount` signals, offset the NAND commit by `inputCount + 1`, and add `setClock`.

- [ ] **Step 4: Run the tests and confirm they pass.** Same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/simulation
git commit -m "feat(simulation): one shared clock signal in the netlist and engine"
```

---

### Task 7: Clock run loop: protocol, session and worker

**Files:**
- Create: `src/features/simulation/domain/clock.ts`
- Modify: `protocol.ts`, `session.ts`, `adapters/engine.worker.ts`, `src/features/simulation/index.ts`
- Test: `clock.test.ts` (new), `protocol.test.ts`, `session.test.ts`

**Interfaces:**
- Consumes: `Engine.setClock` (Task 6).
- Produces:
  - `clock.ts`: `MIN_STEPS_PER_SECOND = 0.5`, `MAX_STEPS_PER_SECOND = 1000`, `DEFAULT_STEPS_PER_SECOND = 4`, `CLOCK_BATCH_MS = 16`, `MAX_STEPS_PER_BATCH = 64`.
  - `stepsDue(carrySteps: number, elapsedMs: number, stepsPerSecond: number): { steps: number; carrySteps: number }`. `pending = carry + max(0, elapsed) * sps / 1000`; `steps = min(floor(pending), 64)`; when capped, carry is 0, otherwise `pending - steps`. A non-finite elapsed counts as 0.
  - `ToEngine` adds `{type:"play"}`, `{type:"pause"}`, `{type:"step"}`, `{type:"setSpeed"; stepsPerSecond}` (validated to `[0.5, 1000]`). `SignalRefSchema` accepts `{kind:"clock"}`.
  - The `FromEngine` state adds `clock: 0|1` and `running: boolean`.
  - `EngineSession.advance(elapsedMs: number): FromEngine | undefined`. Returns `undefined` when not running, not loaded, or no steps are due.
  - Session rules:
    - One step = toggle the clock, then `runUntilStable(SETTLE_TICKS)`.
    - `load` resets the clock to 0 and the carry to 0, and keeps `running` and the speed.
    - Every non-`load` message before a successful load is `BadMessage`.
    - Each control message replies with a state snapshot.
  - Export from `index.ts`: the speed constants (the bridge clamps with them).

- [ ] **Step 1: Write the failing tests**

```ts
// clock.test.ts
test("1 s at 10/s is 10 steps")                  // stepsDue(0, 1000, 10) → {steps:10, carrySteps:0}
test("fractions carry over")                     // stepsDue(0,150,10) → {1, 0.5}; stepsDue(0.5,50,10) → {1, 0}
test("a batch is capped at 64 and the excess dropped") // stepsDue(0,1000,1000) → {64, 0}
test("negative or NaN elapsed adds nothing")     // stepsDue(0.5,-5,10) → {0, 0.5}; NaN → {0, 0.5}
// protocol.test.ts
test.each([{type:"play"},{type:"pause"},{type:"step"},{type:"setSpeed",stepsPerSecond:0.5},{type:"setSpeed",stepsPerSecond:1000}])("accepts %o")
test.each([{type:"setSpeed",stepsPerSecond:0.4},{type:"setSpeed",stepsPerSecond:1001},{type:"setSpeed",stepsPerSecond:Number.NaN}])("rejects %o")
test("a state reply needs clock and running")
// session.test.ts  (CLOCK_NAND = NAND(clock, clock) → output)
test("load reports clock 0, not running")          // toMatchObject {clock:0, running:false, outputs:[1]}
test("step toggles the clock once and settles")    // step → {clock:1, outputs:[0]}; step → {clock:0, outputs:[1]}
test("advance runs due steps only while playing")  // play; advance(1000) → 4 steps → {clock:0, running:true}; pause; advance(1000) → undefined
test("setSpeed changes how many steps are due")    // setSpeed 10; play; advance(100) → {clock:1}
test("a reload while playing keeps playing and the speed, and resets the clock") // Review Focus 5
test("controls and advance before a load are BadMessage / undefined")
describe("clock determinism", () => {              // Review Focus 5
  // CLOCKED_LATCH: n0 = NAND(clock, n1), n1 = NAND(clock, n0); outputs [n0, n1]
  test("same seed and step count give the same state regardless of batching", () => {
    // seed 7, setSpeed 10: A = play + advance(900); B = play + 9 × advance(100); C = 9 × step
    expect(stripRunning(a)).toEqual(stripRunning(b));
    expect(stripRunning(b)).toEqual(stripRunning(c));   // compares tick, stable, outputs, clock
  });
  test("across seeds 1..20 the clocked race has both winners") // after 1 step, outputs include [0,1] and [1,0]
});
```

- [ ] **Step 2: Run them and confirm they fail.** Run `pnpm vitest run src/features/simulation`. Expected: FAIL.

- [ ] **Step 3: Implement** `clock.ts`, the schemas and the session state (`running`, `stepsPerSecond`, `carrySteps`, clock level). In `engine.worker.ts`, post each reply. Whenever a posted `state` has `running: true` and no timer exists, start `setInterval(CLOCK_BATCH_MS)`. Each interval calls `session.advance(now - last)` (with `performance.now()`) and posts any reply. Clear the interval on a `state` with `running: false`.

- [ ] **Step 4: Run the tests and confirm they pass.** Run `pnpm vitest run src/features/simulation && pnpm typecheck`. Expected: PASS, simulation branches ≥ 95%.

- [ ] **Step 5: Commit**

```bash
git add src/features/simulation
git commit -m "feat(simulation): clock run loop with play, pause, step and speed"
```

---

### Task 8: Flattening custom chips and buses into the netlist

**Files:**
- Create: `src/features/circuit-editor/domain/io-layout.ts`
- Rewrite: `src/features/circuit-editor/domain/to-netlist-source.ts`
- Modify: `domain/messages.ts`, `index.ts`, `messages/en.json`, `messages/es.json`
- Test: `io-layout.test.ts` (new), `to-netlist-source.test.ts` (rewritten), `messages.test.ts`

**Interfaces:**
- Consumes: `findChip`, `findInvalidWire`, `endpointInfo` (Tasks 1–2); `NetlistSource`, `SignalRef` with clock (Task 6); `applyAction` (Tasks 4–5) to build scenarios.
- Produces:
  - `interface IoSlot { pinId: PinId; width: BitWidth; offset: number }`. `interface IoLayout { inputs: readonly IoSlot[]; outputs: readonly IoSlot[] }`
  - `ioLayout(circuit: Circuit): IoLayout`. Slots follow `circuit.pins` order per direction; offsets are cumulative bit counts.
  - `packInputs(layout, values: ReadonlyMap<PinId, number>): readonly Level[]`. Bit `i` of a value is `(value >> i) & 1`; a missing value is 0; bits past the width are ignored.
  - `unpackOutputs(layout, bits: readonly Level[]): ReadonlyMap<PinId, number>`
  - `interface Flattened { source: NetlistSource; layout: IoLayout }`
  - `toNetlistSource(project: Project, chipId: ChipId): Result<Flattened, NetlistSourceError>`. It flattens the chip's **draft** and the **saved** versions of every nested chip.
  - `type NetlistSourceError = {type:"ChipNotFound"; chipId} | {type:"ChipNotSaved"; chipId} | {type:"RecursiveChip"; chipId} | {type:"UnconnectedPin"; path: readonly InstanceId[]; instanceId; pin: PinKey; bit: number} | {type:"InvalidWire"; path: readonly InstanceId[]; wireId} | {type:"WireLoop"; path: readonly InstanceId[]; instanceId}`. `path` lists the custom-instance ids from the open chip down; it is `[]` at top level. `UnsupportedPart` is removed.

Algorithm (not determined by the tests beyond ordering; keep it exactly):

```
Frame = { path: InstanceId[]; circuit: Circuit; parent?: Frame; host?: ChipInstance }
1. enumerate(frame, stack: ChipId[]) — pre-order over frame.circuit.instances in array order:
     findInvalidWire(frame.circuit) → InvalidWire {path, wireId}   (once per frame, before descending)
     nand   → append to nands; nandIndex[key(path, id)] = position
     custom → chip missing → ChipNotFound; no saved → ChipNotSaved; chip.id ∈ stack → RecursiveChip;
              enumerate(child frame {path:[...path,id], circuit: chip.saved, parent: frame, host: instance}, [...stack, chip.id])
   (root stack = [openChipId])
2. resolveSink(frame, instanceId, pin, bit): Result<SignalRef>   — memo by `${path}/${instanceId}:${pin}:${bit}`; a key already on the in-progress set → WireLoop
     w = wire in frame with w.to.instanceId/pin matching and (w.to.bit undefined or === bit); none → UnconnectedPin
     srcBit = w.from.bit ?? (w.to.bit === undefined ? bit : 0)
     return resolveSource(frame, w.from.instanceId, w.from.pin, srcBit)
3. resolveSource(frame, id, pin, bit):
     nand  → {kind:"nand", index: nandIndex[key(path,id)]}
     clock → {kind:"clock"}
     pin piece (input def): top frame → {kind:"input", index: slot(pinId).offset + bit}
                            nested    → resolveSink(frame.parent, frame.host.id, pinId, bit)
     split n, pin k → resolveSink(frame, id, 0, k - 1)
     merge n, pin n → resolveSink(frame, id, bit, 0)
     custom → child = frame for [...path, id]; out piece = piece of PinId `pin` in child.circuit;
              resolveSink(child, outPiece.id, 0, bit)
4. source = { inputCount: total input bits, nands: each nand → {a: resolveSink(.., 0, 0), b: resolveSink(.., 1, 0)},
              outputs: for each output slot, for bit 0..width-1: resolveSink(top, piece(slot), 0, bit) }
```

Messages: add the keys below and delete `netlist_error_unsupported_part`. Keep `netlist_error_unconnected_pin` and `netlist_error_invalid_wire`.

| key | en | es |
|---|---|---|
| `netlist_error_chip_not_found` | This circuit uses a chip that is missing from the project. | Este circuito usa un chip que falta en el proyecto. |
| `netlist_error_chip_not_saved` | This circuit uses a chip that has never been saved. | Este circuito usa un chip que nunca se ha guardado. |
| `netlist_error_recursive_chip` | A chip contains itself, so the circuit cannot be simulated. | Un chip se contiene a sí mismo, así que el circuito no se puede simular. |
| `netlist_error_wire_loop` | Wires form a loop that no gate drives, so the circuit cannot be simulated. | Los cables forman un bucle que ninguna puerta activa, así que el circuito no se puede simular. |

- [ ] **Step 1: Write the failing tests**

```ts
// io-layout.test.ts — pins [A(in,1), D(in,4), Y(out,1), Q(out,4)]
test("slots follow Pins-panel order, bit 0 first")  // inputs [{A,1,0},{D,4,1}], outputs [{Y,1,0},{Q,4,1}]
test("packInputs spreads bits; missing pins are 0") // Map([[D,0b1010]]) → [0, 0,1,0,1]
test("packInputs ignores bits past the width")      // D = 0b11111 → [0, 1,1,1,1]
test("unpackOutputs rebuilds values")               // [1, 1,0,1,1] → Map Y→1, Q→13
// to-netlist-source.test.ts
test("the demo flattens to 2 inputs, 1 NAND, 1 output") // source toEqual old expected value
test("a saved custom chip flattens into its NANDs")     // NOT=NAND(a,a); host A→NOT→Y:
  // {inputCount:1, nands:[{a:{kind:"input",index:0}, b:{kind:"input",index:0}}], outputs:[{kind:"nand",index:0}]}
test("nested chips flatten pre-order in instance order")
  // AND.saved = [n0 NAND(a,b), not1 NOT(n0)]; host = [h0 NAND(A,B), and1 AND(A,B)], outputs [Y←and1.y, Z←h0]
  // nands toEqual [{in0,in1}, {in0,in1}, {nand1,nand1}]; outputs toEqual [{nand,2},{nand,0}]
test("nested chips run their saved version, the open chip its draft") // editing NOT.draft leaves host source toEqual before
test("grandparent simulates the new saved version")     // Review Focus 1: save NOT as a buffer → host source changes
test("bus wires expand bit by bit")                    // D(4)→Q(4): outputs [{input,0},{input,1},{input,2},{input,3}]
test("bit taps pick one bit")                          // {D,0,bit:2}→Y: outputs [{input,2}]
test("SPLIT and MERGE are wiring")                     // D→split4; out k→merge4 pin 4-k; merge→Q: outputs [{input,3},{input,2},{input,1},{input,0}]
test("the clock is one shared signal, also inside chips") // nands [{a:{kind:"clock"}, b:{kind:"clock"}}, …nested {kind:"clock"}]
test("reordering a nested chip's pins never rewires")  // Review Focus 4: reorderPin + saveChip on X → host source toEqual before
test("flattening does not depend on wire array order") // reversed wires → toEqual
describe("flattening errors", () => {
  test("unconnected NAND input")        // {type:"UnconnectedPin", path:[], instanceId:N, pin:1, bit:0}
  test("unconnected pin inside a chip carries the path") // path:[x1.id]
  test("draft-only nested chip")        // {type:"ChipNotSaved", chipId}
  test("missing nested or open chip")   // {type:"ChipNotFound", chipId}
  test("a recursive chip from a file terminates") // Review Focus 2: {type:"RecursiveChip", chipId:A}
  test("a wire loop through SPLIT/MERGE")         // merge out → split in, split outs → merge ins: {type:"WireLoop", ...}
  test("a stored-backwards wire")       // {type:"InvalidWire", path:[], wireId}
});
```

Update `messages.test.ts` so `SimulationError` lists every new case, with unique non-empty messages.

- [ ] **Step 2: Run them and confirm they fail.** Run `pnpm vitest run src/features/circuit-editor/domain`. Expected: FAIL.

- [ ] **Step 3: Implement** `io-layout.ts` and the algorithm above, then update `simulationErrorMessage` and the message files. `simulation-bridge.ts` temporarily calls `toNetlistSource(present, state.chipId)` and sends `.source`, so the repo stays green until Task 9.

- [ ] **Step 4: Verify.** Run `pnpm typecheck && pnpm vitest run src/features/circuit-editor`. Expected: PASS, domain branches ≥ 95%.

- [ ] **Step 5: Commit**

```bash
git add src/features/circuit-editor messages
git commit -m "feat(circuit-editor): flatten saved custom chips, buses, split/merge and clock"
```

---

### Task 9: Store, bridge and demo page on the new model

**Files:**
- Modify: `src/features/circuit-editor/application/editor-store.ts`, `application/simulation-bridge.ts`, `domain/signals.ts`, `ui/use-editor-session.ts`, `ui/CircuitCanvas.tsx`, `ui/EditorToolbar.tsx`, `adapters/canvas-renderer.ts`, `index.ts`
- Modify: `src/features/accessibility/ui/CircuitSummary.tsx`, `messages/en.json`, `messages/es.json`
- Test: `editor-store.test.ts`, `simulation-bridge.test.ts`, `signals.test.ts`

**Interfaces:**
- Consumes: `applyAction`, `mapHistory`, `applySavedVersion`, `toNetlistSource`, `ioLayout`, `packInputs`, `unpackOutputs`, and the speed constants.
- Produces:
  - `EditorState`:
    - adds `chipId: ChipId` and `openChip(chipId: ChipId): Result<void, EditorError>`. `ChipNotFound` changes nothing; this does not touch history.
    - `inputs: ReadonlyMap<PinId, number>`
    - `setInput(pinId: PinId, value: number): void`
  - Dispatching `saveChip` commits `mapHistory(history, (snapshot) => applySavedVersion(snapshot, chipId, savedCircuit))` instead of `pushHistory`. `savedCircuit` is the chip's draft in `present` before the save.
  - After `undo`/`redo`, if `chipId` is missing from the new present, `chipId` becomes `present.chips[0].id`.
  - Autosave writes `{ ...present, lastOpenedChipId: chipId }`.
  - `SimulationState { outputs: ReadonlyMap<PinId, number>; clock: Level; running: boolean; stepsPerSecond: number; error: SimulationError | null }`
  - `interface ClockControls { play(): void; pause(): void; step(): void; setSpeed(stepsPerSecond: number): void }`. `setSpeed` clamps to `[MIN, MAX]`, sends the message and stores the value.
  - `connectSimulation(editor, simulation, client): { disconnect: () => void; clock: ClockControls }`. It reloads when `history.present` or `chipId` changes, and sends per-bit `setInput` diffs of `packInputs(layout, inputs)`.
  - `EditorSession` gains `clock: ClockControls`.
  - `KnownLevels { inputs: ReadonlyMap<PinId, number>; outputs: ReadonlyMap<PinId, number> }`. The level is known only for 1-bit pieces.
  - `CircuitSummary`: input switches are keyed by `pinId`, with the label ordinal taken from input pins in Pins-panel order (the same `Input A`/`Input B`/`Output` copy). Other parts are labelled with `part_numbered`.

Messages: add the keys below and delete `part_unsupported`.

| key | en | es |
|---|---|---|
| `chip_clock` | Clock | Reloj |
| `chip_split` | Split {width} | Dividir {width} |
| `chip_merge` | Merge {width} | Unir {width} |
| `part_numbered` | {name} {number} | {name} {number} |

- [ ] **Step 1: Write the failing tests**

```ts
// editor-store.test.ts
test("opens on the project's lastOpenedChipId")
test("openChip switches chips and autosave records it")   // saved.at(-1)?.lastOpenedChipId === other.id; history.past length 0
test("openChip of an unknown chip is ChipNotFound and changes nothing")
test("saveChip is not on the undo stack; undo keeps the new saved version")
  // addPin C to X; saveChip X; past length unchanged by the save; undo → X.saved.pins includes C, X.draft.pins does not
test("undo after removePin restores the pin and its wires")   // spec §5.5
test("undoing createChip while it is open falls back to the first chip")
test("input values follow their pins across reorder")       // Review Focus 4: setInput(A,1); reorderPin B→0; inputs.get(A) === 1
// simulation-bridge.test.ts
test("loads the open chip's netlist and replays inputs per bit")  // sent[0] {type:"load", seed}; then setInput 0→0, 1→0
test("unpacks outputs per pin and mirrors the clock")             // reply {outputs:[1], clock:1, running:true} → outputs.get(OUT) === 1, clock 1, running true
test("opening another chip reloads")
test("clock controls send play, pause, step and a clamped speed") // setSpeed(5000) → {type:"setSpeed", stepsPerSecond:1000}; setSpeed(0) → 0.5
test("a circuit with a clock simulates instead of erroring")      // error null, load sent
test("netlist errors are reported and stale replies ignored")     // existing behaviour, new error shapes
// signals.test.ts: same three cases with Map-based KnownLevels
```

- [ ] **Step 2: Run them and confirm they fail.** Run `pnpm vitest run src/features/circuit-editor/application src/features/circuit-editor/domain/signals.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the store, the bridge, `signals.ts` and the session hook. Then adapt the toolbar (`chipId` from state), the canvas and renderer (Maps), and `CircuitSummary`.

- [ ] **Step 4: Run the full gate.** Run `pnpm check`. Expected: PASS (typecheck, lint, knip, spell, coverage).

- [ ] **Step 5: Confirm the demo still works end to end.** Run `pnpm build && pnpm e2e`. Expected: every spec passes unchanged (`slice`, `keyboard`, `import-export`, `persistence`, `offline`, `a11y`, `hydration`).

- [ ] **Step 6: Commit**

```bash
git add src messages
git commit -m "feat(circuit-editor): open-chip store, save rebase, per-pin inputs and clock controls"
```

---

## Notes for the owner

- **Clock controls have no UI in any planned phase.** The engine, protocol and bridge are complete here, but no roadmap phase (2–6) lists clock play/pause/step/speed UI. I suggest adding it to Phase 2's toolbar work.
- **The stack-depth limit for flattening.** Flattening recurses per wire hop, so very deep pass-through chains (thousands of nested levels) could exhaust the JS stack. The spec's scale (hundreds of chips) is far below that; revisit if Phase 3 profiling shows otherwise.

### Critical Files for Implementation
- /Users/gerardogalan/Code/POC/NAND_Computer_Architecture/src/features/projects/domain/model.ts
- /Users/gerardogalan/Code/POC/NAND_Computer_Architecture/src/features/projects/domain/save-cascade.ts (new)
- /Users/gerardogalan/Code/POC/NAND_Computer_Architecture/src/features/circuit-editor/domain/to-netlist-source.ts
- /Users/gerardogalan/Code/POC/NAND_Computer_Architecture/src/features/simulation/domain/session.ts
- /Users/gerardogalan/Code/POC/NAND_Computer_Architecture/src/features/circuit-editor/application/editor-store.ts