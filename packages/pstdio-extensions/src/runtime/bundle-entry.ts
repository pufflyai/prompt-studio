import { readFileSync, realpathSync } from "node:fs";
import { basename, extname, isAbsolute, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const RUNTIME_BUNDLE_SUFFIX = ".pstdio-runtime-bundle.mjs";
const sourceFilePattern = /\.(?:[cm]js|[jt]sx?)$/;
const javascriptLoaders = new Set<Bun.JavaScriptLoader>(["js", "jsx", "ts", "tsx"]);

const isInside = (root: string, path: string) => {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

const asJavaScriptLoader = (loader: Bun.Loader) =>
  javascriptLoaders.has(loader as Bun.JavaScriptLoader) ? (loader as Bun.JavaScriptLoader) : "js";

const packageRelativePath = (realPackagePath: string, realPath: string) => {
  const rel = relative(realPackagePath, realPath).replaceAll("\\", "/");
  return rel;
};

const shouldPreserveImportMetaUrl = (relativePath: string) =>
  relativePath !== "node_modules" && !relativePath.startsWith("node_modules/");

const preserveImportMetaUrlPlugin = (packagePath: string) => {
  const realPackagePath = realpathSync(packagePath);

  return {
    name: "pstdio-preserve-extension-import-meta-url",
    setup(build: Bun.PluginBuilder) {
      build.onLoad({ filter: sourceFilePattern }, (args) => {
        const realPath = realpathSync(args.path);
        if (!isInside(realPackagePath, realPath)) return;

        const relativePath = packageRelativePath(realPackagePath, realPath);
        if (!shouldPreserveImportMetaUrl(relativePath)) return;

        const source = readFileSync(args.path, "utf8");
        if (!source.includes("import.meta.url")) return;

        const sourcePath = join(packagePath, relativePath);
        const loader = asJavaScriptLoader(args.loader);
        const transpiler = new Bun.Transpiler({
          define: { "import.meta.url": JSON.stringify(pathToFileURL(sourcePath).href) },
          loader,
          target: "bun",
        });

        return { contents: transpiler.transformSync(source, loader), loader: "js" as const };
      });
    },
  };
};

// Bundling gives development and compiled hosts the same dependency resolution. Host source
// conditions must not select files omitted from published packages, and compiled Bun cannot
// resolve an externally imported module's node_modules. Dependencies are treated uniformly.
export const bundleEntry = async (entryPath: string, packagePath: string, outDir: string) => {
  const bundlePath = join(outDir, `${basename(entryPath, extname(entryPath))}${RUNTIME_BUNDLE_SUFFIX}`);
  if (await Bun.file(bundlePath).exists()) return bundlePath;

  const result = await Bun.build({
    entrypoints: [entryPath],
    target: "bun",
    throw: false,
    outdir: outDir,
    naming: `[name]${RUNTIME_BUNDLE_SUFFIX}`,
    plugins: [preserveImportMetaUrlPlugin(packagePath)],
  });

  if (!result.success) {
    throw new Error(
      `Failed to bundle extension entry ${entryPath}: ${result.logs.map((log) => String(log)).join("; ")}`,
    );
  }

  return bundlePath;
};
