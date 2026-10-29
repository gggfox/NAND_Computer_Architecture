import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/adapters/**",
        "**/ui/**",
        "src/shared/ui/**",
        "src/routes/**",
        "src/routeTree.gen.ts",
      ],
      thresholds: {
        // Global Constraint: simulation (adapters/ excluded above), every feature domain, shared (ui/ excluded above).
        "src/features/simulation/**": { branches: 95 },
        "src/features/*/domain/**": { branches: 95 },
        "src/shared/**/*.ts": { branches: 95 },
      },
    },
  },
});
