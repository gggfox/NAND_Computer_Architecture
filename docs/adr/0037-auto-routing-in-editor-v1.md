# 37. Automatic wire routing ships with the editor (amends ADR 9)

Wires are routed automatically along a clean right-angle path that avoids chips, from the first editor version, instead of a later "tidy up" feature. Bends the user moves by hand are kept (wires carry a manual-waypoints flag); the rest re-route when chips move. Wiring is tap-pin-then-tap-pin (drag also works), with animation.
