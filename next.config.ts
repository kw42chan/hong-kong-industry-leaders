import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    // Equivalent of next-intl's `createNextIntlPlugin("./src/i18n/request.ts")`.
    // The plugin eagerly loads @swc/core (for its message extractor), whose
    // native binding fails to load on some Windows setups; the alias is all we need.
    resolveAlias: {
      "next-intl/config": "./src/i18n/request.ts",
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
