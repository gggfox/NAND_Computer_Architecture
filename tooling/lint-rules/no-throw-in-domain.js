// Local oxlint JS plugin: bans `throw` in domain code (ADR 28, 36).
// - src/features/simulation/** (except adapters/) and src/features/*/domain/**: no throw at all.
// - convex/**: only `throw new ConvexError(...)`.
// - src/shared/assert-never.ts is exempt (the single sanctioned throw).

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

const SIMULATION = /\/features\/simulation\//u;
const ADAPTERS = /\/adapters\//u;
const FEATURE_DOMAIN = /\/features\/[^/]+\/domain\//u;
const CONVEX = /\/convex\//u;
const EXEMPT_SUFFIX = "/src/shared/assert-never.ts";

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
    const filename = (context.physicalFilename ?? context.filename).replaceAll("\\", "/");
    if (filename.endsWith(EXEMPT_SUFFIX)) {
      return {};
    }
    const isDomain =
      (SIMULATION.test(filename) && !ADAPTERS.test(filename)) || FEATURE_DOMAIN.test(filename);
    const isConvex = CONVEX.test(filename);
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

const plugin = {
  meta: { name: "local" },
  rules: { "no-throw-in-domain": rule },
};

export default plugin;
