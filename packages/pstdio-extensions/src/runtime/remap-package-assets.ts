import { realpathSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isPackageAssetDescriptor } from "../artifacts/asset-validation";

const remapRuntimeBaseUrl = (baseUrl: string, runtimePackagePath: string, packagePath: string) => {
  try {
    const basePath = fileURLToPath(new URL(baseUrl));
    const realRuntimePackagePath = realpathSync(runtimePackagePath);
    const realBasePath = realpathSync(basePath);
    const rel = relative(realRuntimePackagePath, realBasePath);
    if (rel.startsWith("..") || isAbsolute(rel)) return baseUrl;
    return pathToFileURL(join(packagePath, rel)).href;
  } catch {
    return baseUrl;
  }
};

export const remapRuntimePackageAssets = (value: unknown, runtimePackagePath: string, packagePath: string): unknown => {
  if (isPackageAssetDescriptor(value))
    return { ...value, baseUrl: remapRuntimeBaseUrl(value.baseUrl, runtimePackagePath, packagePath) };
  if (Array.isArray(value))
    return value.map((item) => remapRuntimePackageAssets(item, runtimePackagePath, packagePath));
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, remapRuntimePackageAssets(item, runtimePackagePath, packagePath)]),
  );
};
