import { paraglideVitePlugin } from "@inlang/paraglide-js";
import babel from "@rolldown/plugin-babel";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { patchCssModules } from "vite-css-modules";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  /*
   * Bind IPv4 loopback explicitly. With the default `localhost`, Node can listen on ::1 while
   * fetch resolves localhost to 127.0.0.1 only (ADDRCONFIG in IPv6-less CI containers), so
   * TanStack Start's build-time prerender of `_shell.html` gets ECONNREFUSED.
   */
  preview: { host: "127.0.0.1" },
  plugins: [
    // Outdir, strategy and declarations come from project.inlang/paraglide.config.ts, shared with `pnpm i18n`.
    paraglideVitePlugin({ project: "./project.inlang" }),
    tanstackStart({ spa: { enabled: true } }),
    patchCssModules({ generateSourceTypes: true }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});
