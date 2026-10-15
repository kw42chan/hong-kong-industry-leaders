import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Root vitest.config.mts only includes src/** and scripts/**; run with
// `pnpm exec vitest run --config tests/ranking/vitest.config.mts`.
export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../../src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/ranking/**/*.test.ts"],
  },
});
