import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { structureOf, wireTargets } from "~/features/circuit-editor";
import type { PinEntry, WireTarget } from "~/features/circuit-editor";
import { createDemoProject, EMPTY_CIRCUIT } from "~/features/projects";
import { newInstanceId } from "~/shared/ids";

import { PinActions } from "./PinActions";
import { StructureSessionContext } from "./structure-session";
import { createTestSession } from "./structure-session.fixtures";
import { WireToForm } from "./WireToDialog";
import type { WireToFormProps } from "./WireToDialog";

const noop = (): void => undefined;

const demo = createDemoProject("test");
const [chip, ...others] = demo.chips;
const bare =
  chip === undefined
    ? demo
    : { ...demo, chips: [{ ...chip, draft: { ...chip.draft, wires: [] } }, ...others] };
const session = createTestSession(bare);
const project = session.editor.getState().history.present;
const circuit = project.chips[0]?.draft ?? EMPTY_CIRCUIT;
const scene = { project, circuit };
const { parts } = structureOf(scene);

const pinOf = (label: string, name: string): PinEntry => {
  const pin = parts
    .find((part) => part.label === label)
    ?.pins.find((candidate) => candidate.name === name);
  if (pin === undefined) {
    throw new Error(`No pin ${name} on ${label}`);
  }
  return pin;
};

const inputA = pinOf("Input A", "A");
const nandA = pinOf("NAND gate 1", "a");

const target = (width: number, bits: number): WireTarget => ({
  ref: { instanceId: newInstanceId(), pin: 0 },
  label: "d of Bus",
  width,
  bits,
});

const form = (over: Partial<WireToFormProps> = {}): string =>
  renderToStaticMarkup(
    <WireToForm
      pin={over.pin ?? inputA}
      pinLabel={over.pinLabel ?? "A of Input A"}
      targets={over.targets ?? []}
      query=""
      onQueryChange={noop}
      chosen={over.chosen}
      onChoose={noop}
      bits={over.bits ?? { from: 0, target: 0 }}
      onBitsChange={noop}
      error={over.error}
      onWire={noop}
      onClose={noop}
    />,
  );

describe("WireToForm", () => {
  it("says that no pin is chosen, in a polite line", () => {
    expect(form()).toMatch(/aria-live="polite"[^>]*>No pin chosen\./u);
  });

  it("names the chosen pair and asks for no bit between one-bit ends", () => {
    const [first] = wireTargets(scene, inputA.ref);
    const markup = form({ chosen: first });
    expect(markup).toContain(`Wire A of Input A to ${first?.label ?? ""}`);
    expect(markup).not.toContain("Bit of");
  });

  it("asks for a bit on a bus target when the source is one bit", () => {
    const markup = form({ chosen: target(4, 4), bits: { from: 0, target: 2 } });
    expect(markup).toContain("Bit of d of Bus");
    expect(markup).not.toContain("Bit of A of Input A");
    expect(markup).toContain("A of Input A to d of Bus, bit 2");
  });

  it("asks for a bit on the source when it is a bus and the target is one bit", () => {
    const bus = { ...inputA, width: 4 };
    const markup = form({ pin: bus, chosen: target(1, 1) });
    expect(markup).toContain("Bit of A of Input A");
    expect(markup).not.toContain("Bit of d of Bus");
  });

  it("names the pair in the direction of the signal for an input pin", () => {
    const [first] = wireTargets(scene, nandA.ref);
    expect(form({ pin: nandA, pinLabel: "a of NAND gate 1", chosen: first })).toContain(
      `Wire ${first?.label ?? ""} to a of NAND gate 1`,
    );
  });
});

describe("WireToForm parts", () => {
  it("shows a refusal as an alert", () => {
    expect(form({ error: "Already driven" })).toMatch(/role="alert"[^>]*>Already driven</u);
  });

  it("shows no alert without a refusal", () => {
    expect(form()).not.toContain('role="alert"');
  });

  it("keeps the search outside the form, so Enter there cannot submit", () => {
    const markup = form();
    expect(markup.indexOf("Search pins")).toBeLessThan(markup.indexOf("<form"));
  });

  it("has Cancel and Wire buttons, and a message when nothing matches", () => {
    const markup = form();
    expect(markup).toContain("Cancel");
    expect(markup).toContain(">Wire<");
    expect(markup).toContain("No pin matches.");
  });
});

const renderActions = (pin: PinEntry): string =>
  renderToStaticMarkup(
    <StructureSessionContext value={session}>
      <PinActions pin={pin} />
    </StructureSessionContext>,
  );

describe("PinActions", () => {
  it("names the menu button after the pin and its part", () => {
    expect(renderActions(nandA)).toContain('aria-label="Actions for a of NAND gate 1"');
  });

  it("keeps the dialog closed until the menu item is chosen", () => {
    expect(renderActions(inputA)).not.toContain("Search pins");
  });
});

describe("wire targets for the dialog", () => {
  it("lists only legal pins for an output pin", () => {
    const labels = wireTargets(scene, inputA.ref).map(({ label }) => label);
    expect(labels).toContain("a of NAND gate 1");
    expect(labels).not.toContain("A of Input A");
  });
});
