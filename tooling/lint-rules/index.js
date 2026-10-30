// Local oxlint JS plugin: the repo's own rules, reported as `local/<rule>`.

import noRestrictedDynamicImport from "./no-restricted-dynamic-import.js";
import noThrowInDomain from "./no-throw-in-domain.js";

const plugin = {
  meta: { name: "local" },
  rules: {
    "no-restricted-dynamic-import": noRestrictedDynamicImport,
    "no-throw-in-domain": noThrowInDomain,
  },
};

export default plugin;
