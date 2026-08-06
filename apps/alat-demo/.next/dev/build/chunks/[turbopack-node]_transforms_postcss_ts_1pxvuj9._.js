module.exports = [
"[turbopack-node]/transforms/postcss.ts?config=[project]/apps/alat-demo/postcss.config.mjs { CONFIG => \"[project]/apps/alat-demo/postcss.config.mjs [postcss] (ecmascript)\" } [postcss] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "chunks/node_modules__pnpm_0y076d_._.js",
  "chunks/[root-of-the-server]__122-98m._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[turbopack-node]/transforms/postcss.ts?config=[project]/apps/alat-demo/postcss.config.mjs { CONFIG => \"[project]/apps/alat-demo/postcss.config.mjs [postcss] (ecmascript)\" } [postcss] (ecmascript)");
    });
});
}),
];