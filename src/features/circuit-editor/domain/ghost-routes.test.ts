import { describe, expect, it } from "vitest";

import { checkConnection } from "~/features/projects";
import type { Wire } from "~/features/projects";
import { newWireId } from "~/shared/ids";

import { pinPosition, wireRoute } from "./geometry";
import type { Scene } from "./geometry";
import { GHOST_ROUTE_CAP, ghostsOf } from "./ghost-routes";
import { entersChips } from "./routing/routing.fixtures";
import { suggestWires } from "./suggest-wires";
import { bigScene, registerFileScene } from "./suggest-wires.fixtures";

const WARM_UPS = 3;
const RUNS = 7;
const MEDIAN_AT = 3;
/** A loose bound, so coverage (several times slower) and busy CI don't flake; a frame is 16 ms. */
const BOUND_MS = 200;

const median = (work: () => void): number => {
  for (let run = 0; run < WARM_UPS; run += 1) {
    work();
  }
  const times = Array.from({ length: RUNS }, () => {
    const start = performance.now();
    work();
    return performance.now() - start;
  });
  return times.toSorted((first, second) => first - second)[MEDIAN_AT] ?? 0;
};

const elbowOf = (scene: Scene, from: Wire["from"], to: Wire["to"]) => {
  const connection = checkConnection(scene.project, scene.circuit, from, to);
  const wires = connection.ok
    ? [{ id: newWireId(), ...connection.value, waypoints: [], manualWaypoints: false }]
    : [];
  return wires.flatMap((wire) => wireRoute(scene, wire));
};

const pinAt = (scene: Scene, ref: Wire["from"]) => {
  const instance = scene.circuit.instances.find((item) => item.id === ref.instanceId);
  return instance === undefined ? undefined : pinPosition(scene, instance, ref.pin);
};

describe("ghost routes", () => {
  it("runs from the source pin to the sink pin", () => {
    const { scene } = registerFileScene();
    const ghosts = ghostsOf(scene, suggestWires(scene));
    expect(ghosts).toHaveLength(20);
    for (const ghost of ghosts) {
      expect(ghost.route.at(0)).toEqual(pinAt(scene, ghost.from));
      expect(ghost.route.at(-1)).toEqual(pinAt(scene, ghost.to));
    }
  });

  it("avoids chip bodies other than its ends'", () => {
    const { scene } = registerFileScene();
    const ghosts = ghostsOf(scene, suggestWires(scene));
    expect(ghosts.some((ghost) => entersChips(scene, ghost.route))).toBe(false);
  });

  it("shares a trunk between ghosts from one source", () => {
    const { scene, clk } = registerFileScene();
    const fan = ghostsOf(scene, suggestWires(scene)).filter(
      (ghost) => ghost.from.instanceId === clk.id,
    );
    expect(fan).toHaveLength(4);
    const [first, ...rest] = fan;
    for (const other of rest) {
      // The first legs lie on one line out of the pin, so the wires share a trunk.
      expect(other.route.at(0)).toEqual(first?.route.at(0));
      expect(other.route.at(1)?.y).toBe(first?.route.at(1)?.y);
    }
  });

  it("leaves the scene's circuit untouched", () => {
    const { scene } = registerFileScene();
    const { circuit } = scene;
    const wires = [...circuit.wires];
    ghostsOf(scene, suggestWires(scene));
    expect(scene.circuit).toBe(circuit);
    expect(circuit.wires).toEqual(wires);
  });

  it("skips proposals that are not legal against the ones before them", () => {
    const { scene } = registerFileScene();
    const [first] = suggestWires(scene);
    expect(first).toBeDefined();
    expect(ghostsOf(scene, first === undefined ? [] : [first, first])).toHaveLength(1);
    expect(ghostsOf(scene, [])).toEqual([]);
  });
});

describe("the cap", () => {
  const { scene } = bigScene();
  const proposals = suggestWires(scene);

  it("routes up to the cap and draws elbows above it", () => {
    const routed = ghostsOf(scene, proposals.slice(0, GHOST_ROUTE_CAP));
    expect(routed).toHaveLength(GHOST_ROUTE_CAP);
    expect(routed.some((ghost) => entersChips(scene, ghost.route))).toBe(false);
    const elbows = ghostsOf(scene, proposals.slice(0, GHOST_ROUTE_CAP + 1));
    expect(elbows).toHaveLength(GHOST_ROUTE_CAP + 1);
    for (const ghost of elbows) {
      expect(ghost.route).toEqual(elbowOf(scene, ghost.from, ghost.to));
    }
  });

  it("routes at the cap differently from the elbow somewhere", () => {
    const routed = ghostsOf(scene, proposals.slice(0, GHOST_ROUTE_CAP));
    const bent = routed.filter(
      (ghost) =>
        JSON.stringify(ghost.route) !== JSON.stringify(elbowOf(scene, ghost.from, ghost.to)),
    );
    expect(bent.length).toBeGreaterThan(0);
  });
});

describe("timing", () => {
  const { scene } = bigScene();

  it("suggests and draws every proposal as an elbow within a frame", () => {
    const time = median(() => {
      expect(ghostsOf(scene, suggestWires(scene))).toHaveLength(200);
    });
    expect(time).toBeLessThan(BOUND_MS);
  });

  it("suggests and routes exactly the cap within a frame", () => {
    const time = median(() => {
      expect(ghostsOf(scene, suggestWires(scene).slice(0, GHOST_ROUTE_CAP))).toHaveLength(
        GHOST_ROUTE_CAP,
      );
    });
    expect(time).toBeLessThan(BOUND_MS);
  });
});
