# Editor Phase 3: Wiring (design)

**Builds on:** the circuit editor design (`2026-10-29-circuit-editor-design.md`, §5.2 Wiring, §5.10 Buses and single bits, §5.11 branching) and ADR 37 (auto-routing in v1). The spec decisions still stand. This document adds what the owner decided for Phase 3 on 2026-10-30, and marks the builder's own calls.
**Branch:** `claude/phase-3-wiring`, from `main` after PR #21 (Phase 2) merged.

## 1. Intent and why

Phase 2 made chips movable. You still can't draw a wire, and the wires that exist look wrong:
- they run under the chips they connect, because today's route is the shortest bend and ignores chips;
- they double back through a chip when the input sits to the left of the output.

The owner wants to build, in order: simple gates, a D latch, half and full adders, an ALU, and later perhaps a graphics accelerator. Wiring is the main activity in all of these. The thing that would annoy them most is **wires on top of wires**: when you can't tell how many wires run along a line, you can't read the circuit.

Success: wiring a full adder or a D latch, which has feedback loops, feels quick, and the result reads cleanly. Wires don't hide under chips, don't lie on top of each other, and their colours help you follow a signal.

## 2. Goals

1. **Draw wires.** Tap a pin, then tap a second pin; dragging from pin to pin also works (spec §5.2).
   - After the first tap the pin is armed: legal targets stay bright and illegal ones fade.
   - A target is illegal when widths differ or when two outputs would be joined.
   - Tapping empty canvas or pressing Escape cancels the armed state.
   - The new wire animates in along its route. The animation is skipped under `prefers-reduced-motion`.
2. **Route around chips (owner).**
   - A wire leaves an output pin outward (to the right) and enters an input pin from its own side (from the left).
   - It never passes through or under any chip rectangle, including the two chips it connects.
   - When the input lies behind or beside the output, the wire goes around the outside of the chips. The owner's screenshots show exactly this, and it matters most for latch feedback loops.
   - Wires keep a small clearance from chip edges.
3. **No wire on top of wire (owner).**
   - Two wires never share a segment. Parallel runs are spaced at least one half-grid cell (20 world px) apart.
   - Crossing another wire at a right angle is allowed. A few crossings are fine, and the router prefers fewer.
4. **Branches** (spec §5.11 and the owner).
   - Starting a wire from an existing wire makes a new wire from that wire's source pin.
   - Where branches from one source share a trunk, they are drawn once, with a junction dot at the split.
   - Sharing a trunk is the one case where wires may overlap: they carry the same signal and are drawn as one line.
5. **Hand-adjusted bends** (spec §5.2).
   - Long-press or right-click a wire to open its menu: Move bends, Colour…, Delete.
   - In bend mode, bends can be dragged. They snap to the grid and keep the segments at right angles.
6. **Bit picker** (spec §5.10).
   - While a 1-bit wire is being drawn, tapping a bus pin shows a small picker (`d0 d1 d2 d3`). The wire attaches to that one bit.
   - The pin card shows which bits are used.
7. **Wire colours (owner).**
   - **Look (owner chose mockup B):**
     - on: the wire's colour at full strength, with a soft glow;
     - off: a muted, dashed version of the same colour;
     - unknown (the circuit can't run): unchanged from today, the neutral wire colour with `?`;
     - an uncoloured wire uses today's wire colour.
   - **Three ways to colour (owner):**
     - **Pick first:** the toolbar holds a "next wire colour" swatch. New wires use it until it changes.
     - **Colour after:** Colour… in the wire menu.
     - **Recolour many:** select several wires with Shift+click (a selection box also works, but it matters less to the owner), then choose Colour…. It is one undo step.
   - **Branches inherit** their parent's colour and ignore the "next wire colour" (owner). They can be recoloured afterwards.
   - **Glow** is dropped automatically when zoomed far out (owner agreed). Below that zoom it isn't visible anyway, and it costs frame time.

## 3. Non-goals

- Wiring several pins at once, and Suggest wires. Both are Phase 5.
- The library, placing pins, the Pins panel and creating custom chips in the UI. All are Phase 4.
- The full screen-reader editing view. That is Phase 6. Phase 3 still gives wiring a keyboard path (§6).
- A free colour picker. Colours come from a fixed palette (§6).

## 4. Anti-goals (a failure even if it works)

- Wires drawn over or under chips.
- Two different wires sharing a line, so you can't count them.
- Dragging a chip stutters because routing runs every frame on a large circuit.
- Wire colour replaces the signal level. Colour never stops showing on and off: the dashes and the glow always do.

## 5. Decisions (owner)

- **Hand bends give way to the router (amends ADR 37).**
  - When either end chip of a hand-shaped wire moves, the wire drops its bends and is re-routed automatically.
  - ADR 37 said manual bends are kept when chips move. A new ADR records this change.
- **Colour is part of the circuit.** It is saved with the project, exported, and undoable. Changing it is an edit, like moving a chip.
- **The off style is muted, dashed colour (mockup B).** The dashes keep on and off readable without relying on colour alone, which matters for colour-blind users and the High contrast theme.

- **The router never moves wires you didn't touch (owner).**
  - Adding, re-routing or moving a wire routes only that wire, plus the wires the edit itself affects. It works around every other wire as it is.
  - In a crowded area the new route may squeeze or overlap; the fallback in §6 covers this.
  - A **"Tidy wires"** command re-routes every automatic wire in the open chip, as one undo step, when the owner asks for it. Hand-shaped wires are left alone.
  - Tidy wires is in the menu you get by long-pressing or right-clicking empty canvas, and in the toolbar overflow.

## 6. Builder's calls (made by Claude, open to the owner's veto)

- **Both ends move together.** When both end chips move in the same drag, the hand bends are translated with them, as Phase 2 already does. Only one end moving triggers a re-route.
- **Which wires re-route.**
  - A chip move re-routes every wire touching a moved chip.
  - It also re-routes automatic wires whose path a moved chip now blocks.
  - Hand-shaped wires whose chips did not move keep their bends, even if a chip now sits on them. The owner can fix them by hand, or with "Re-route" in the wire menu.
- **Routing during a drag.**
  - While dragging, affected wires show a cheap preview route: plain right-angle, without avoidance.
  - The full avoid-and-space route runs once on release, inside the same single `moveChips` undo step.
  - This keeps Phase 2's drag budget (p95 ≤ 20 ms at 300 chips and 600 wires, 4× throttle) and avoids the stutter anti-goal.
  - The Phase 3 spike (roadmap) measures full routing speed and may allow routing live during the drag if it is fast enough.
- **Routes are stored, not recomputed per frame.**
  - The router writes waypoints into the wire, as an automatic route with `manualWaypoints: false`. Rendering just draws them.
  - Routes are therefore deterministic, survive reloads, and the canvas never routes while drawing.
  - Existing wires: see §6.1.
- **The router.**
  - It runs on the grid, with chip rectangles plus clearance as obstacles.
  - It is A* with costs for length, bends and crossings. Running alongside another wire's segment within 20 world px is forbidden, except for trunks shared by branches of the same source.
  - Pins have a direction (outputs exit right, inputs enter left), and the route must start and end in that direction.
  - If no legal route exists, for example in a very crowded area, the router falls back to the best route that still avoids chips and allows parallel overlap, and that wire is marked in the pin card. It never routes through a chip.
- **The palette.**
  - It has 8 swatches plus "default". All of them pass contrast against the canvas in Light, Dark and High contrast.
  - The muted off colour is derived from each swatch.
  - In High contrast, colours keep their hue, but on and off also differ in thickness.
  - This follows how custom chips pick colours today.
- **Model.**
  - `Wire` gains an optional `color` (a palette key; absent means default).
  - The project format version goes up, with a migration in `projects/domain/migrations.ts`, so old files load.
  - New `EditorAction`s:
    - `recolorWires` (many wires, one step);
    - `rerouteWires`;
    - `connectWire`, extended with the colour.
- **Keyboard wiring (follows Phase 2's "every gesture has a keyboard equivalent").**
  - With a chip selected, `P` steps through its pins, as today.
  - `W` arms the focused pin.
  - `]`/`[` and `P` then move to a target pin, and `Enter` connects.
  - `Escape` cancels.
  - The wire menu opens with `Enter` or `Shift+F10` on a selected wire.
  - Exact keys are the builder's call, and the help dialog lists them.
- **Glow cut-off.** Below zoom 0.5 the glow is not drawn.
- **Wire hit target.** At least 24 px, as in Phase 2.
- **Order of work.**
  1. Router spike and the routing model first.
  2. Then drawing wires: armed state, tap-tap, drag, and the animation.
  3. Then colours and the wire menu with bend editing.
  4. Then the bit picker.
  5. Then E2E, axe and perf.

### 6.1 Calls made after the builder check (Claude's, open to veto)

- **Existing wires are routed once on open.**
  - Today every wire has `waypoints: []` and is drawn as a render-time midpoint elbow, which is the look the owner dislikes.
  - When a chip opens, its automatic wires that have no waypoints are routed and stored, outside undo history. The demo and old projects look right straight away.
  - The render-time elbow then becomes only the drag preview. *(Replaces the "keep their current waypoints" call above.)*
- **Default-colour wires keep the signal tokens.**
  - A wire with no colour keeps today's `signal-high` (on) and dashed `signal-low` (off).
  - On wires gain the glow, so existing circuits change only by that glow.
  - A chosen colour replaces the signal tokens with full colour (on) and muted, dashed colour (off).
- **Legal targets with buses.**
  - With a 1-bit pin armed, bus pins stay bright, and tapping one opens the bit picker.
  - With a bus pin armed, tapping a 1-bit pin opens the picker for the armed bus end.
  - Bus-to-bus needs equal width.
  - These fade as illegal: an input that is already driven, input-to-input, output-to-output, and the armed pin's own chip when that would make an input-to-input connection.
  - All of these follow the existing `projects/domain/wiring.ts` checks.
- **Trunks and bus pins.**
  - A trunk is shared only by wires with the same source pin **and** bit **and** colour. Taps on `d0` and `d1` of one bus never merge.
  - Wires to different bits of one bus pin leave its anchor together and fan out after the first grid cell. That first stub is the only place where different wires may touch.
- **Starting a branch.**
  - A drag that starts on a wire draws a new wire from that wire's source (and bit). Tap on a wire still selects it, and Shift+tap still toggles it.
  - The wire menu also has "Branch".
  - The junction sits wherever the router merges the trunk, not at the tapped point, because the model has no wire-on-wire anchors (spec §5.11).
  - "Parent" means the wire the branch started from. Starting from the source pin itself uses the "next wire colour".
- **Pin anchors snap to the half-grid.**
  - `chip-layout` rounds each pin centre to the nearest 20 world px, so routes enter pins without jogs.
  - This changes some custom-chip layouts. The NAND and the demo are already on-grid. Visual baselines are regenerated in Docker if they change.
- **Re-route triggers.** Anything that puts a chip on top of automatic wires re-routes the blocked wires in the same undo step:
  - placing a chip;
  - moving chips;
  - a pin edit that resizes a chip;
  - a save cascade that grows a custom chip inside a parent.
  - **Both ends moved together:** a hand-shaped wire translates its bends (Phase 2 behaviour), and an automatic wire re-routes.
- **Hand bends are the escape hatch.**
  - Bend mode snaps bends to the grid and keeps right angles.
  - It allows the owner to place a segment on another wire or through a chip. That is their choice, and the router doesn't fight it.
  - "Re-route" in the wire menu returns the wire to automatic.
- **Colour storage.**
  - `color` is a palette key (`"blue"`, `"orange"`, …), stored as a Zod enum.
  - Each key maps to per-theme token values, so Light, Dark and High contrast each get a passing colour.
  - Wires have their own palette rather than reusing the chip hex swatches, which are not theme-aware.

## 7. Left to the builder

- The router's exact cost weights, clearance (suggest half a grid cell), and how crowded areas degrade.
- Animation timing for a new wire.
- Junction dot size, and the exact trunk-sharing rules.
- The 8 palette colours, and the muted-colour formula (suggest mixing toward the canvas background, checked with `src/shared/contrast.ts`).
- How bend editing looks on touch: handles on bends, 24 px targets.
- Performance budgets for the router, set from the spike. Target: re-routing the wires of a 50-chip selection on release in under 100 ms on the Pixel 7 profile.

## 8. Risks to spike early

- **Router speed and quality** on large circuits: hundreds of chips now, a graphics accelerator later. That includes the no-parallel-overlap rule, which makes routing order matter.
- **Glow cost:** canvas `shadowBlur` is expensive. Draw the glow as a second wide, low-alpha stroke instead, and measure it against the Phase 2 drag budget.
