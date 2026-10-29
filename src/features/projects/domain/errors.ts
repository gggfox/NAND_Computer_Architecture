import { m } from "~/i18n/paraglide/messages";
import { assertNever } from "~/shared/assert-never";

export type ImportError =
  | { readonly type: "TooLarge"; readonly bytes: number }
  | { readonly type: "InvalidJson" }
  | { readonly type: "NotAProjectFile" }
  | { readonly type: "UnsupportedVersion"; readonly version: number }
  | { readonly type: "FutureVersion"; readonly version: number; readonly supported: number }
  | { readonly type: "InvalidProject"; readonly issues: readonly string[] };

export const importErrorMessage = (importError: ImportError): string => {
  switch (importError.type) {
    case "TooLarge": {
      return m.import_error_too_large();
    }
    case "InvalidJson": {
      return m.import_error_invalid_json();
    }
    case "NotAProjectFile": {
      return m.import_error_not_a_project();
    }
    case "UnsupportedVersion": {
      return m.import_error_unsupported_version({ version: importError.version });
    }
    case "FutureVersion": {
      return m.import_error_future_version({
        version: importError.version,
        supported: importError.supported,
      });
    }
    case "InvalidProject": {
      return m.import_error_invalid_project();
    }
    default: {
      return assertNever(importError);
    }
  }
};
