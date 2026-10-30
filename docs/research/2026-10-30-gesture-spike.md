# Gesture disambiguation spike (Phase 2, Task 0)

Issue #13 asks for this spike before the canvas gesture layer lands. The question is whether one Pointer Events recognizer can tell these apart reliably on real iOS Safari and Android Chrome:
- tap, drag, long-press, pinch and two-finger pan;
- a second finger added mid-drag;
- the system's own gestures.

It also checks whether a 300-chip drag stays at 60 fps.

## Harness

`tooling/spikes/gestures.html` is a single static page with no build step and no app code. It runs the candidate state machine from the Phase 2 plan (Task 6), with these live sliders:
- **touch slop**: 4–24 px (the mouse is fixed at 4);
- **long-press**: 250–900 ms;
- **edge guard**: 0–40 px. Touches starting this close to the left or right edge are ignored, against the iOS back-swipe.

It shows the recognised gesture in large type, and keeps a log that can include raw events. After each drag or pinch it reports frame times (p50/p95 of `requestAnimationFrame` deltas) over a 300-chip scene.

To open it on a phone on the same network, serve the folder statically. The app's dev server routes every path to the SPA, so it cannot serve the page.

```bash
python3 -m http.server 8000 --directory tooling/spikes
# then on the phone: http://<computer-ip>:8000/gestures.html
```

Any static host works too, for example dropping the file on a preview deploy.

Smoke-checked in Playwright Chromium with Pixel 7 emulation and CDP touch events: tap, drag, long-press and pinch were each recognised, with no page errors. Emulation proves the wiring only. **The findings below need real devices.**

## Checklist (run on each device)

Do each item 5 times with the default thresholds (10 px, 500 ms, 16 px). Then adjust the sliders until it feels right, and record both results.

1. **Tap** a chip, then empty canvas: a `tap` every time, and never a `dragStart`.
2. **Drag** a chip slowly, at normal speed, and as a fast flick: a `dragStart` follows the finger without a visible jump. Note the "after N ms" value and the coalesced count.
3. **Long-press**, holding still: `longPress` at about the slider value, with no iOS callout, magnifier or text selection.
4. **Long-press with tremor**, holding naturally and not rigidly: it still gives `longPress`, not `dragStart`. This is the main input for tuning the slop.
5. **Long-press then drag**: `dragStart afterLongPress=true`, used for the lasso.
6. **Pinch** in and out: smooth zoom about the fingers, with no page zoom.
7. **Two-finger pan** (fingers parallel): the scene pans, with no browser scroll or overscroll bounce.
8. **Second finger mid-drag**: `dragEnd (second finger: commit)` then `pinchStart`. The dragged chip stays where it was.
9. **Lift one finger of a pinch**, then move the other: no stray tap or drag (`drained pointer`).
10. **Edge swipe from the left** (iOS back, Android back gesture): with the guard at 0, does the browser steal it? With the guard at 16, is it ignored cleanly?
11. **Palm or a third finger** resting on the screen: `third pointer ignored`, and the first two keep working.
12. **Stylus** (Apple Pencil, S Pen) if available: pointerType `pen`, and it behaves like touch.
13. **300-chip drag**: drag one chip in circles for 3 s and record p50/p95. The target is p95 ≤ 20 ms.
14. **Incoming notification or app switch mid-drag**: `dragCancel` or `cancel`, and nothing stuck.

## Findings

| # | iOS Safari (device, iOS version) | Android Chrome (device, version) |
|---|---|---|
| 1 Tap | | |
| 2 Drag | | |
| 3 Long-press | | |
| 4 Long-press tremor | | |
| 5 Long-press → drag | | |
| 6 Pinch | | |
| 7 Two-finger pan | | |
| 8 Second finger mid-drag | | |
| 9 Lift one of two | | |
| 10 Edge swipe | | |
| 11 Third pointer | | |
| 12 Stylus | | |
| 13 300-chip drag p50/p95 | | |
| 14 Interruption | | |

**Chosen thresholds:** touch slop ___ px, long-press ___ ms, edge guard ___ px (iOS only? both?).

## Decisions to carry into Task 6

- [ ] Update `TOUCH_SLOP`, `LONG_PRESS_MS` and the edge guard in the Phase 2 plan's Decisions section, if they differ from 10 px, 500 ms and 16 px.
- [ ] If item 8 feels wrong (for example, users expect to keep holding the chip while panning), revisit "commit the drag, then pinch".
- [ ] If item 13 misses the target on the mid-range Android phone, the renderer needs the Task 5 culling and layout cache before Task 10 wires input.
