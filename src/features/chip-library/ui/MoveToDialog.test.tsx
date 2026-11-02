import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MoveToForm } from "./MoveToDialog";

const noop = (): void => undefined;

describe("MoveToForm", () => {
  it("shows a refusal as an alert", () => {
    const markup = renderToStaticMarkup(
      <MoveToForm
        options={[{ id: "top", label: "Top level" }]}
        choice="top"
        onChoose={noop}
        error="Folder not found"
        onSave={noop}
        onClose={noop}
      />,
    );
    expect(markup).toMatch(/role="alert"[^>]*>Folder not found</u);
  });
});
