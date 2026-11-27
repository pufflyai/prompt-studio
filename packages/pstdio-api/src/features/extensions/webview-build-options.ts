export const extensionWebviewBuildOptions = {
  target: "browser",
  format: "esm",
  splitting: true,
  define: { "process.env.NODE_ENV": '"production"' },
  minify: true,
  naming: { entry: "module.[ext]", chunk: "chunk-[hash].[ext]", asset: "[name]-[hash].[ext]" },
  outputFormat: 1,
} satisfies Partial<Bun.BuildConfig> & { outputFormat: number };
