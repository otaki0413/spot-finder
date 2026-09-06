import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: "./",
    include: ["test/**/*.integration-spec.ts"],
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
