/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { buildLattice, FREE, nodeAt } from "./lattice";

describe("buildLattice", () => {
  it("clears a wire's own anchor, stub edge and stub's outer cell of other signals", () => {
    const box = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    // Another signal leaves the same pin (5,5) rightward and turns at the stub's outer cell (6,5).
    const points = [
      { x: 5, y: 5 },
      { x: 6, y: 5 },
      { x: 6, y: 0 },
    ];
    const other = { signal: 7, points, box: { minX: 5, minY: 0, maxX: 6, maxY: 5 } };
    const stub = { anchor: { x: 5, y: 5 }, heading: 0 };
    const lattice = buildLattice({ box, rects: [], routes: [other], stubs: [stub] });
    const [anchor, outer, beyond] = points.map((point) => nodeAt(lattice, point));
    expect([lattice.nodes[anchor ?? 0], lattice.stops[anchor ?? 0]]).toEqual([FREE, 0]);
    expect([lattice.nodes[outer ?? 0], lattice.stops[outer ?? 0]]).toEqual([FREE, 0]);
    expect(lattice.across[Math.min(anchor ?? 0, outer ?? 0)]).toBe(FREE);
    // Past the outer cell the other signal still holds its nodes.
    expect(lattice.stops[beyond ?? 0]).toBe(1);
  });
});
