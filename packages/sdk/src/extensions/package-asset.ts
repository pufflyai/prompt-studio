import type { PackageAssetDescriptor } from "./types/resources";

export const packageAsset = (path: string, baseUrl: string): PackageAssetDescriptor => ({
  kind: "package-asset",
  path,
  baseUrl,
});
