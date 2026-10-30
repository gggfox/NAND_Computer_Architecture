# 40. Buses reach single bits through bit taps and split/merge built-ins

A 1-bit wire may attach to one bit of a bus pin (bit picker while wiring); bus-to-bus wires need equal width. SPLIT n / MERGE n built-ins (n = 4, 8, 16) exist for users who prefer explicit conversion. Both flatten to per-bit signals; the engine stays 1-bit.
