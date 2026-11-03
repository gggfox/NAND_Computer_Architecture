/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { InstanceIdSchema } from "~/shared/ids";

import { initialInteraction } from "../domain/interaction";
import type { Ghost } from "../domain/suggestion-types";
import { ghostsOf } from "./ghosts-of";

const IDLE = initialInteraction({ zoom: 1, x: 0, y: 0 }, "select");
const end = { instanceId: InstanceIdSchema.parse(crypto.randomUUID()), pin: 0 };
const ghost = (x: number): Ghost => ({
  from: end,
  to: end,
  route: [
    { x, y: 0 },
    { x, y: 10 },
  ],
});

describe("ghostsOf", () => {
  it("gives nothing without suggestions", () => {
    expect(ghostsOf(IDLE)).toEqual({});
  });

  it("maps each ghost's route and marks only the focused one", () => {
    const state = { ...IDLE, suggestions: { ghosts: [ghost(1), ghost(2)], focus: 1 } };
    expect(ghostsOf(state)).toEqual({
      ghosts: [
        { route: ghost(1).route, focused: false },
        { route: ghost(2).route, focused: true },
      ],
    });
  });

  it("marks none when nothing is focused, and passes the wire colour on", () => {
    const state = { ...IDLE, wireColor: "teal" as const, suggestions: { ghosts: [ghost(1)] } };
    const view = ghostsOf(state);
    expect(view.ghosts?.map((item) => item.focused)).toEqual([false]);
    expect(view.ghostColor).toBe("teal");
  });
});
