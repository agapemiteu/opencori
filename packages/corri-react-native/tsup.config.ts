import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  target: "es2022",
  clean: true,
  dts: { resolve: true },
  noExternal: [/^@corri\//],
  sourcemap: true,
  splitting: false,
});
