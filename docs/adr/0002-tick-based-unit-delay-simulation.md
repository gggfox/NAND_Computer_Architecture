# 2. Tick-based simulation with one-tick gate delay

The simulation advances in discrete ticks; every NAND takes exactly one tick to propagate. This makes feedback loops (latches, flip-flops) well-defined, allows pause and single-step, and is a uniform per-tick loop that ports cleanly to WASM or WebGPU later.

Rejected: zero-delay levelized evaluation (cannot express feedback loops without special handling) and variable-delay event simulation (more complex, no learning benefit for this project).
