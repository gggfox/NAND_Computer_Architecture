import { describe, expect, it } from "vitest";

import { importErrorMessage } from "~/features/projects";
import { ProjectIdSchema } from "~/shared/ids";

import { persistenceErrorMessage } from "./errors";

const id = ProjectIdSchema.parse("11111111-1111-4111-8111-111111111111");

describe("persistenceErrorMessage", () => {
  it("describes every error case with a non-empty message", () => {
    const messages = [
      persistenceErrorMessage({ type: "NotFound", id }),
      persistenceErrorMessage({ type: "QuotaExceeded" }),
      persistenceErrorMessage({ type: "Unavailable" }),
    ];
    for (const message of messages) {
      expect(message.length).toBeGreaterThan(0);
    }
    expect(new Set(messages).size).toBe(3);
  });

  it("includes the import failure reason for corrupt records", () => {
    const cause = { type: "InvalidJson" } as const;
    expect(persistenceErrorMessage({ type: "Corrupt", id, cause })).toContain(
      importErrorMessage(cause),
    );
  });
});
