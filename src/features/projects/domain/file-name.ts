export const MAX_FILE_NAME_LENGTH = 100;
const FALLBACK_NAME = "project";
const EXTENSION = ".nand.json";

// Path separators, characters reserved on Windows/macOS, and control characters.
// oxlint-disable-next-line no-control-regex -- control characters are exactly what is stripped
const UNSAFE = /[<>:"/\\|?*\u0000-\u001F\u007F]+/gu;
const WHITESPACE = /\s+/gu;
// Leading dots would hide the file or walk up a directory; edge dashes and spaces are leftovers.
const EDGES = /^[\s.-]+|[\s.-]+$/gu;

/** A safe download name for a project; names come from untrusted imports, so nothing is kept raw. */
export const projectFileName = (name: string): string => {
  const safe = name
    .replaceAll(UNSAFE, "-")
    .replaceAll(WHITESPACE, " ")
    .replaceAll(EDGES, "")
    .slice(0, MAX_FILE_NAME_LENGTH);
  return `${safe === "" ? FALLBACK_NAME : safe}${EXTENSION}`;
};
