import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        branches: 90,
        functions: 100,
        lines: 97,
        statements: 97,
      },
    },
  },
});
