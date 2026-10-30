# 44. Wiring, routing and wire colours (amends ADR 37)

Wires are drawn by tap-tap, drag or keyboard. A tap on a pin arms it, and a second tap on a legal pin connects. When a 1-bit pin meets a bus with no bit chosen, a bit picker offers the legal bits. Arming, the picker, bend mode, menus and the next wire colour are interaction state, so they are not edits (ADR 43). Every edit, with its routing, is one action and one undo step.

A pure, deterministic router puts each route's bends in `Wire.waypoints`, so drawing never routes. It runs inside the reducer, never per frame. During a drag, wires on moved chips draw the simple elbow. The router never moves a wire the edit did not affect: an edit re-routes only wires newly blocked, per instance, by an instance it placed, moved or resized. A batch routes around settled wires only, so stale routes of pending wires are not obstacles. "Tidy wires" is the one explicit exception and re-routes every automatic wire in the open chip.

This amends ADR 37. A hand-bent wire (`manualWaypoints`) keeps its bends when its ends move apart, is translated when both ends move by the same delta, and is dropped and re-routed when exactly one end chip moves. Bends are edited in bend mode, by dragging a segment handle or with `]`/`[` and the arrow keys.

Spacing is by signal: source pin, bit and colour. Wires of different signals never share a lattice edge or turn on each other's nodes, and may cross at right angles. Wires of one signal merge into a trunk, drawn once with junction dots. With no legal route the router retries letting other signals' edges cost extra, then returns `NoRoute` and the wire keeps the elbow; connecting never fails.

Wire colour follows mockup B: eight named colours plus the default, each with a muted theme token of at least 3:1 contrast against the background. On wires are full colour and one pixel thicker, off wires muted and dashed. High wires get a glow (a wide, low-alpha stroke), skipped below zoom 0.5. There is no format version bump: `Wire.color` is optional, so version-1 files parse unchanged and an older app drops the key.

In the Pan tool, a drag on a wire pans, so one-finger panning stays possible in dense wiring. Branching by drag needs the Select tool, or "Branch" in the wire menu. Keyboard wiring uses `w` to arm and `n`/`N` to step through the selected chip's wires.

Measured: re-routing 50 chips' worth of wires (about 102 wires) takes a median of about 17 ms, and about 69 ms under coverage, against a 280 ms budget in `route-perf.test.ts`. The `@perf` drag p95 is about 16.7-16.8 ms against the 20 ms budget. Opening a 600-wire legacy project routes it once, in about 111 ms on desktop.
