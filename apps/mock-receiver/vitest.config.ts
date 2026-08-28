import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["**/main.ts"],
      thresholds: {
        branches: 75,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
});
