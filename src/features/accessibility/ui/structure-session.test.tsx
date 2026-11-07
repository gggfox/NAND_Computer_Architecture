import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StructureSessionContext, useStructureSession } from "./structure-session";
import { createTestSession } from "./structure-session.fixtures";

const ChipCount = (): ReactNode => {
  const session = useStructureSession();
  return session.editor.getState().history.present.chips.length;
};

describe("useStructureSession", () => {
  it("reads the session that the provider gives", () => {
    const session = createTestSession();
    const chips = session.editor.getState().history.present.chips.length;
    const markup = renderToStaticMarkup(
      <StructureSessionContext value={session}>
        <ChipCount />
      </StructureSessionContext>,
    );
    expect(markup).toBe(String(chips));
  });

  it("fails without a provider", () => {
    expect(() => renderToStaticMarkup(<ChipCount />)).toThrow(/StructureView/u);
  });
});
