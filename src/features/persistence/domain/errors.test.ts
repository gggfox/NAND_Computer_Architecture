import { afterEach, describe, expect, it } from "vitest";

import { importErrorMessage } from "~/features/projects";
import { overwriteGetLocale } from "~/i18n/paraglide/runtime";
import { ProjectIdSchema } from "~/shared/ids";

import { persistenceErrorMessage } from "./errors";

const id = ProjectIdSchema.parse("11111111-1111-4111-8111-111111111111");

describe("persistenceErrorMessage", () => {
  it("describes every error case with a non-empty message", () => {
    const messages = [
      persistenceErrorMessage({ type: "NotFound", id }),
      persistenceErrorMessage({ type: "QuotaExceeded" }),
      persistenceErrorMessage({ type: "Blocked" }),
      persistenceErrorMessage({ type: "Unavailable" }),
    ];
    for (const message of messages) {
      expect(message.length).toBeGreaterThan(0);
    }
    expect(new Set(messages).size).toBe(4);
  });

  it("includes the import failure reason for corrupt records", () => {
    const cause = { type: "InvalidJson" } as const;
    expect(persistenceErrorMessage({ type: "Corrupt", id, cause })).toContain(
      importErrorMessage(cause),
    );
  });

  describe("in Spanish", () => {
    afterEach(() => {
      overwriteGetLocale(() => "en");
    });
    it("describes every error case in Spanish", () => {
      overwriteGetLocale(() => "es");
      const cause = { type: "InvalidJson" } as const;
      expect([
        persistenceErrorMessage({ type: "NotFound", id }),
        persistenceErrorMessage({ type: "Corrupt", id, cause }),
        persistenceErrorMessage({ type: "QuotaExceeded" }),
        persistenceErrorMessage({ type: "Unavailable" }),
      ]).toEqual([
        "No se encontró ese proyecto en este navegador.",
        expect.stringContaining(
          "El proyecto guardado está dañado y no se pudo abrir. El archivo no es un JSON válido.",
        ),
        expect.stringContaining("almacenamiento del navegador está lleno"),
        expect.stringContaining("almacenamiento del navegador no está disponible"),
      ]);
    });
  });

  it("rejects an unknown error with assertNever", () => {
    /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Deliberately violates the exhaustive union to hit assertNever */
    const unknown = JSON.parse('{"type":"Bogus"}') as never;
    expect(() => persistenceErrorMessage(unknown)).toThrow("Unexpected value");
  });
});
