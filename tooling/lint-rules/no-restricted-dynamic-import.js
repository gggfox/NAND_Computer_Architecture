// Local oxlint JS rule: the `import()` counterpart of `no-restricted-imports` (static imports only).
// Oxlint has no `no-restricted-syntax`, so the dynamic-import ban lives here.
// Options mirror `no-restricted-imports`: `{ patterns: [{ group: string[], message: string }] }`.
// A group entry is an exact module name, or ends in `/*` to match every subpath of that module.
// Only static specifiers (string literals, template literals without expressions) can be checked.

/**
 * @typedef {Readonly<{ group: readonly string[], message: string }>} Pattern
 * @typedef {Readonly<{ patterns?: readonly Pattern[] }>} Options
 * @typedef {Readonly<{ value: Readonly<{ cooked: string | null }> }>} Quasi
 * @typedef {Readonly<{
 *   type: string,
 *   value?: unknown,
 *   expressions?: readonly unknown[],
 *   quasis?: readonly Quasi[],
 * }>} SourceNode
 * @typedef {Readonly<{ type: "ImportExpression", source: SourceNode }>} ImportNode
 * @typedef {Readonly<{
 *   node: SourceNode,
 *   messageId: "restricted",
 *   data: Readonly<Record<string, string>>,
 * }>} Report
 * @typedef {Readonly<{
 *   options: readonly (Options | undefined)[],
 *   report: (report: Report) => void,
 * }>} RuleContext
 */

const WILDCARD = "*";

/**
 * @param {SourceNode} source
 * @returns {string} the module specifier, or "" when it is computed at runtime
 */
function staticSpecifier(source) {
  if (source.type === "Literal" && typeof source.value === "string") {
    return source.value;
  }
  if (source.type === "TemplateLiteral" && source.expressions?.length === 0) {
    return source.quasis?.[0]?.value.cooked ?? "";
  }
  return "";
}

/**
 * @param {string} specifier
 * @param {string} entry `name` (exact) or `name/*` (any subpath)
 * @returns {boolean}
 */
function matches(specifier, entry) {
  return entry.endsWith(`/${WILDCARD}`)
    ? specifier.startsWith(entry.slice(0, -WILDCARD.length))
    : specifier === entry;
}

const rule = {
  meta: {
    type: "problem",
    docs: { description: "Disallow dynamic `import()` of restricted modules." },
    messages: { restricted: "'{{specifier}}' import is restricted from being used. {{message}}" },
    schema: [
      {
        type: "object",
        properties: {
          patterns: {
            type: "array",
            items: {
              type: "object",
              properties: {
                group: { type: "array", items: { type: "string" } },
                message: { type: "string" },
              },
              required: ["group", "message"],
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  /**
   * @param {RuleContext} context
   * @returns {Readonly<{ ImportExpression?: (node: ImportNode) => void }>}
   */
  create(context) {
    const patterns = context.options[0]?.patterns ?? [];
    if (patterns.length === 0) {
      return {};
    }
    return {
      ImportExpression(node) {
        const specifier = staticSpecifier(node.source);
        if (specifier === "") {
          return;
        }
        const hit = patterns.find((pattern) =>
          pattern.group.some((entry) => matches(specifier, entry)),
        );
        if (hit !== undefined) {
          context.report({
            node: node.source,
            messageId: "restricted",
            data: { specifier, message: hit.message },
          });
        }
      },
    };
  },
};

export default rule;
