// Maps a linted file to its path from the repo root, so local rules can anchor their path patterns.
// Lint canaries live under tooling/lint-canaries/, which mirrors the repo root layout.

// A `file:` URL path of a Windows drive (`/C:/repo/`) loses its leading slash to match file names.
const WINDOWS_DRIVE = /^\/(?=[A-Za-z]:\/)/u;
const ROOT = decodeURIComponent(new URL("../../", import.meta.url).pathname).replace(
  WINDOWS_DRIVE,
  "",
);
const CANARY_ROOT = "tooling/lint-canaries/";

/**
 * @param {string} filename absolute path of the linted file
 * @returns {string} the root-relative path with `/` separators, or "" outside the repo
 */
export function projectPath(filename) {
  const normalized = filename.replaceAll("\\", "/");
  if (!normalized.startsWith(ROOT)) {
    return "";
  }
  const relative = normalized.slice(ROOT.length);
  return relative.startsWith(CANARY_ROOT) ? relative.slice(CANARY_ROOT.length) : relative;
}
