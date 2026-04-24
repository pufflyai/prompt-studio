import type { PackageAssetDescriptor } from "./types";

export const packageAsset = (sourcePath: string, baseUrl: string | URL) =>
  ({
    kind: "package-asset",
    sourcePath,
    baseUrl: baseUrl.toString(),
  }) satisfies PackageAssetDescriptor;
