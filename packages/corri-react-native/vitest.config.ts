import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.ts"],
      thresholds: {
        branches: 75,
        functions: 85,
        lines: 90,
        statements: 90,
      },
    },
  },
});
