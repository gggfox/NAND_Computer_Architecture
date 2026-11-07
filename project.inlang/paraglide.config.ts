import { defineConfig } from "@inlang/paraglide-js";

/*
 * One source of truth for Paraglide: `pnpm i18n` (the CLI) and the Vite plugin both read this file.
 * `outdir` resolves against the project root, not this folder.
 */
export default defineConfig({
  outdir: "./src/i18n/paraglide",
  strategy: ["localStorage", "preferredLanguage", "baseLocale"],
  emitTsDeclarations: true,
});
