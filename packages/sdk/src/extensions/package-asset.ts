import type { PackageAssetDescriptor } from "./types/resources";

/**
 * Reference an asset shipped alongside the extension's compiled output. `path` is
 * resolved relative to `baseUrl`; in practice authors always pass `import.meta.url`
 * so the runtime can locate the file no matter where the extension is installed.
 *
 * @example
 *   webview: { entry: packageAsset("./dist/page.html", import.meta.url) }
 */
export const packageAsset = (path: string, baseUrl: string): PackageAssetDescriptor => ({
  kind: "package-asset",
  path,
  baseUrl,
});
