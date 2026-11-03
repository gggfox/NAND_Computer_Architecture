/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import { wire } from "~/features/projects";

import { interact } from "./interact";
import { afterHistory } from "./interaction-history";
import { pinOf } from "./interaction-pin-select.fixtures";
import { suggestionsAfter } from "./interaction-suggest";
import { dispatches, suggested } from "./interaction-suggest.fixtures";
import { command } from "./interaction.fixtures";
import { EMPTY_SELECTION, withPins } from "./selection";

/** The register file after the accept of ghost `index`, plus the wires it made real. */
const accepted = (index: number) => {
  const base = suggested();
  const result = command(base.state, base.context, { type: "acceptGhost", index });
  const { suggestions } = result.state;
  const ghost = base.ghosts[index];
  assert(suggestions !== undefined && ghost !== undefined && suggestions.accepting?.[0]);
  const made = { ...wire(ghost.from, ghost.to), id: suggestions.accepting[0] };
  const { circuit } = base.scene;
  const scene = { ...base.scene, circuit: { ...circuit, wires: [...circuit.wires, made] } };
  return { ...base, suggestions, scene, ghost };
};

describe("suggestionsAfter", () => {
  it("keeps the others once the accepted wire is in the circuit, without accepting", () => {
    const { suggestions, scene } = accepted(3);
    const after = suggestionsAfter(suggestions, scene);
    expect(after?.ghosts).toEqual(suggestions.ghosts);
    expect(after).not.toHaveProperty("accepting");
  });

  it("drops everything when the accept did not happen, or there was none", () => {
    const { suggestions, context } = accepted(3);
    expect(suggestionsAfter(suggestions, context.scene)).toBeUndefined();
    expect(suggestionsAfter({ ghosts: suggestions.ghosts }, context.scene)).toBeUndefined();
    expect(suggestionsAfter(undefined, context.scene)).toBeUndefined();
  });

  it("drops a ghost that is now illegal, moving the focus with the rest", () => {
    const { suggestions, scene, ghosts } = accepted(3);
    const [first, second] = suggestions.ghosts;
    assert(first !== undefined && second !== undefined);
    const circuit = {
      ...scene.circuit,
      wires: [...scene.circuit.wires, wire(first.from, first.to)],
    };
    const stale = { ...suggestions, focus: 1 };
    const after = suggestionsAfter(stale, { ...scene, circuit });
    expect(after?.ghosts).toHaveLength(suggestions.ghosts.length - 1);
    expect(after?.ghosts[0]).toBe(second);
    expect(after?.focus).toBe(0);
    expect(ghosts).toHaveLength(20);
  });

  it("ends with nothing left to show", () => {
    const { suggestions, scene } = accepted(3);
    expect(suggestionsAfter({ ...suggestions, ghosts: [] }, scene)).toBeUndefined();
  });
});

describe("afterHistory and the ghosts", () => {
  it("keeps them only for the accept itself", () => {
    const { state, suggestions, scene, context } = accepted(3);
    const kept = afterHistory({ ...state, suggestions }, scene);
    expect(kept.suggestions?.ghosts).toHaveLength(19);
    expect(kept.suggestions?.accepting).toBeUndefined();
    expect(afterHistory({ ...state, suggestions }, context.scene).suggestions).toBeUndefined();
    const plain = suggested();
    expect(afterHistory(plain.state, plain.scene).suggestions).toBeUndefined();
  });

  it("historyChanged through interact never dispatches", () => {
    const { state, suggestions, scene, context } = accepted(3);
    const result = interact(
      { ...state, suggestions },
      { type: "historyChanged" },
      { ...context, scene },
    );
    expect(result.effects).toEqual([]);
    expect(result.state.suggestions?.ghosts).toHaveLength(19);
  });

  it("an undo clears them", () => {
    const { state, suggestions, context } = accepted(3);
    const undone = command({ ...state, suggestions }, context, { type: "undo" });
    expect(undone.effects).toEqual([{ type: "undo" }]);
    const changed = interact(undone.state, { type: "historyChanged" }, context);
    expect(changed.state.suggestions).toBeUndefined();
  });
});

describe("nothing is applied without confirmation", () => {
  it("only the accepts dispatch", () => {
    const { state, context, regs } = suggested();
    const [first] = regs;
    assert(first !== undefined);
    const inputs = [
      { type: "suggestWires" },
      { type: "nextGhost", backwards: false },
      { type: "nextGhost", backwards: true },
      { type: "dismissGhosts" },
      { type: "escape" },
      { type: "acceptGhost" },
    ] as const;
    for (const input of inputs) {
      expect(dispatches(command(state, context, input))).toEqual([]);
    }
    expect(dispatches(interact(state, { type: "historyChanged" }, context))).toEqual([]);
    expect(dispatches(command(state, context, { type: "acceptAllGhosts" }))).toHaveLength(1);
  });
});

/** Three Escapes from pins, ghosts and a card. */
const escapes = () => {
  const { state, context, regs } = suggested();
  const [first] = regs;
  assert(first !== undefined);
  const pin = pinOf(first);
  const card = { ...pin, screen: { x: 1, y: 1 }, pinned: true };
  const busy = { ...state, selection: withPins(EMPTY_SELECTION, [pin]), card };
  const escape = { type: "escape" } as const;
  const one = command(busy, context, escape);
  const two = command(one.state, context, escape);
  return { card, one, two, three: command(two.state, context, escape) };
};

describe("Escape", () => {
  it("clears the pins, then the ghosts, then the card", () => {
    const { card, one, two, three } = escapes();
    expect([one.state.selection.pins, one.state.suggestions === undefined]).toEqual([[], false]);
    expect([two.state.suggestions, two.state.card]).toEqual([undefined, card]);
    expect(three.state.card).toBeUndefined();
  });

  it("announces the dismissal on the second", () => {
    expect(escapes().two.effects).toEqual([
      { type: "announce", announcement: { type: "dismissed" } },
    ]);
  });
});
