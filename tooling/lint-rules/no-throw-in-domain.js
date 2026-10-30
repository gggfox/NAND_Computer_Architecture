// Local oxlint JS rule: bans `throw` in domain code (ADR 28, 36).
// - src/features/simulation/** (except src/features/simulation/adapters/**) and src/features/*/domain/**: no throw at all.
// - convex/**: only `throw new ConvexError(...)`.
// - src/shared/assert-never.ts is exempt (the single sanctioned throw).
// Paths are matched from the repo root (tooling/lint-canaries/ mirrors it), so a directory named
// `adapters` or `convex` elsewhere in a path can neither exempt a file nor pull it in.

import { projectPath } from "./project-path.js";

/**
 * @typedef {Readonly<{ type: string, name?: string }>} Callee
 * @typedef {Readonly<{ type: string, callee?: Callee }>} ThrowArgument
 * @typedef {Readonly<{ type: "ThrowStatement", argument: ThrowArgument | null }>} ThrowNode
 * @typedef {Readonly<{ node: ThrowNode, messageId: "domain" | "convex" }>} Report
 * @typedef {Readonly<{
 *   filename: string,
 *   physicalFilename?: string,
 *   report: (report: Report) => void,
 * }>} RuleContext
 */

const SIMULATION = "src/features/simulation/";
const SIMULATION_ADAPTERS = "src/features/simulation/adapters/";
const FEATURE_DOMAIN = /^src\/features\/[^/]+\/domain\//u;
const CONVEX = "convex/";
const EXEMPT = "src/shared/assert-never.ts";

/**
 * @param {ThrowArgument | null} argument
 * @returns {boolean}
 */
function isConvexError(argument) {
  return (
    argument?.type === "NewExpression" &&
    argument.callee?.type === "Identifier" &&
    argument.callee.name === "ConvexError"
  );
}

const rule = {
  meta: {
    type: "problem",
    docs: { description: "Disallow `throw` in domain code; return a Result instead." },
    messages: {
      domain: "`throw` is banned in domain code. Return a Result instead (ADR 28).",
      convex: "Only `throw new ConvexError(...)` is allowed in convex/ (ADR 36).",
    },
    schema: [],
  },
  /**
   * @param {RuleContext} context
   * @returns {Readonly<{ ThrowStatement?: (node: ThrowNode) => void }>}
   */
  create(context) {
    const file = projectPath(context.physicalFilename ?? context.filename);
    if (file === EXEMPT) {
      return {};
    }
    const isDomain =
      (file.startsWith(SIMULATION) && !file.startsWith(SIMULATION_ADAPTERS)) ||
      FEATURE_DOMAIN.test(file);
    const isConvex = file.startsWith(CONVEX);
    if (!isDomain && !isConvex) {
      return {};
    }
    return {
      ThrowStatement(node) {
        if (isDomain) {
          context.report({ node, messageId: "domain" });
        } else if (!isConvexError(node.argument)) {
          context.report({ node, messageId: "convex" });
        }
      },
    };
  },
};

export default rule;
