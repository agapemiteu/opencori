import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        branches: 85,
        functions: 80,
        lines: 95,
        statements: 95,
      },
    },
  },
});
