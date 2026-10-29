import { importErrorMessage } from "~/features/projects";
import type { ImportError } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { assertNever } from "~/shared/assert-never";
import type { ProjectId } from "~/shared/ids";

export type PersistenceError =
  | { readonly type: "NotFound"; readonly id: ProjectId }
  | { readonly type: "Corrupt"; readonly id: ProjectId; readonly cause: ImportError }
  | { readonly type: "QuotaExceeded" }
  | { readonly type: "Unavailable" };

/* oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- branded ids are mutable object types; the value is never mutated */
export const persistenceErrorMessage = (persistenceError: PersistenceError): string => {
  switch (persistenceError.type) {
    case "NotFound": {
      return m.persistence_error_not_found();
    }
    case "Corrupt": {
      return m.persistence_error_corrupt({ reason: importErrorMessage(persistenceError.cause) });
    }
    case "QuotaExceeded": {
      return m.persistence_error_quota();
    }
    case "Unavailable": {
      return m.persistence_error_unavailable();
    }
    default: {
      return assertNever(persistenceError);
    }
  }
};
