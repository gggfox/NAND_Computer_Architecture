import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { structureOf } from "~/features/circuit-editor";
import { createDemoProject, EMPTY_CIRCUIT } from "~/features/projects";
import type { InstanceId, PinId } from "~/shared/ids";

import { StructureBody, StructureSkipLink } from "./StructureView";

const noop = (): void => undefined;

const project = createDemoProject("demo");
const circuit = project.chips[0]?.draft ?? EMPTY_CIRCUIT;
const structure = structureOf({ project, circuit });

interface Options {
  readonly selected?: ReadonlySet<InstanceId>;
  readonly expanded?: ReadonlySet<InstanceId>;
}

const render = ({ selected = new Set(), expanded = new Set() }: Options = {}): string => {
  const output = circuit.pins.find((pin) => pin.direction === "output");
  const outputs = new Map<PinId, number>(output ? [[output.id, 1]] : []);
  return renderToStaticMarkup(
    <StructureBody
      structure={structure}
      inputs={new Map()}
      outputs={outputs}
      pinNames={new Map(circuit.pins.map((pin) => [pin.id, pin.name]))}
      selected={selected}
      expanded={expanded}
      onToggle={noop}
      onSetInput={noop}
    />,
  );
};

const count = (markup: string, pattern: RegExp): number => markup.match(pattern)?.length ?? 0;

describe("StructureView", () => {
  it("is a region named Circuit structure with Parts and Wires headings", () => {
    const markup = render();
    expect(markup).toMatch(/<section[^>]*aria-labelledby="circuit-structure-heading"/u);
    expect(markup).toMatch(
      /<h2[^>]*id="circuit-structure-heading"[^>]*tabindex="-1"[^>]*>Circuit structure</u,
    );
    expect(markup).toMatch(/<h3[^>]*>Parts</u);
    expect(markup).toMatch(/<h3[^>]*>Wires</u);
  });

  it("shows the four parts and three wires of the demo", () => {
    const markup = render();
    expect(count(markup, /Pins<\/button>/gu)).toBe(4);
    expect(count(markup, /Wire from /gu)).toBe(3);
  });

  it("words the input switches and the output as before", () => {
    const markup = render();
    expect(markup).toContain("Input A");
    expect(markup).toContain("Input B");
    expect(markup).toMatch(/<output[^>]*aria-live="polite"[^>]*>Output OUT: 1</u);
  });

  it("hides the pins until a part opens", () => {
    expect(render()).not.toContain("not connected");
    const nand = structure.parts.find((part) => part.kind === "nand");
    const expanded = new Set<InstanceId>(nand ? [nand.instanceId] : []);
    const markup = render({ expanded });
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toMatch(/a, input, width 1, A of Input A</u);
    expect(markup).toMatch(/out, output, width 1, OUT of Output OUT</u);
  });

  it("says selected after the selected part", () => {
    const [first] = structure.parts;
    const selected = new Set<InstanceId>(first ? [first.instanceId] : []);
    expect(count(render({ selected }), /selected</gu)).toBe(1);
    expect(render()).not.toMatch(/>selected</u);
  });

  it("has a skip link that targets the heading", () => {
    expect(renderToStaticMarkup(<StructureSkipLink />)).toMatch(
      /href="#circuit-structure-heading"[^>]*>Skip to circuit structure</u,
    );
  });
});
