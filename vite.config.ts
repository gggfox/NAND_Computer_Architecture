import { paraglideVitePlugin } from "@inlang/paraglide-js";
import babel from "@rolldown/plugin-babel";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { patchCssModules } from "vite-css-modules";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/i18n/paraglide",
      strategy: ["localStorage", "preferredLanguage", "baseLocale"],
      // Same output as the `i18n` script, so `pnpm lint` still passes after `pnpm build`.
      emitTsDeclarations: true,
    }),
    tanstackStart({ spa: { enabled: true } }),
    patchCssModules({ generateSourceTypes: true }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});
