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

**2026-10-30, owner run on iOS Safari and Android Chrome:** the harness "works fine" on both. Every gesture was recognised as intended with the default thresholds, and there were no problems with the system's own gestures or with frame rate. Device models, OS versions and the per-item frame times were not recorded. If a later phase needs them, for example a performance regression on the 300-chip drag, rerun items 4, 8, 10 and 13 and fill in this table.

| # | iOS Safari | Android Chrome |
|---|---|---|
| 1–14 | as intended, default thresholds | as intended, default thresholds |

**Chosen thresholds:** touch slop 10 px, long-press 500 ms, edge guard 16 px on touch on both platforms (the defaults; unchanged).

## Decisions carried into Task 6

- [x] `TOUCH_SLOP = 10`, `LONG_PRESS_MS = 500`, and the 16 px edge guard for touch, all unchanged.
- [x] Item 8: "commit the drag, then pinch" stays.
- [x] Item 13: no frame-rate problem was reported. The Task 13 `@perf` budget still guards it.
