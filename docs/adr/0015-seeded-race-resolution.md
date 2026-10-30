# 15. Races resolve with a seeded random generator

Simultaneous changes (e.g. an SR latch released from S=R=1) resolve randomly, like real hardware, using a fast seeded PRNG. The seed is saved with the project and carried in share links; tests pin it; a "reroll seed" control exposes circuits that depend on luck.

Rejected: pure determinism (latches oscillate forever, confusing for learners) and unseeded randomness (bugs not reproducible, shares behave differently).
