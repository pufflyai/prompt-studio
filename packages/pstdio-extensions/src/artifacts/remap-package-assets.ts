import { realpathSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isPackageAssetDescriptor } from "./asset-validation";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isInside = (root: string, path: string) => {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

const remapRuntimeBaseUrl = (baseUrl: string, runtimePackagePath: string, packagePath: string) => {
  try {
    const basePath = fileURLToPath(new URL(baseUrl));
    const realRuntimePackagePath = realpathSync(runtimePackagePath);
    const realBasePath = realpathSync(basePath);
    if (!isInside(realRuntimePackagePath, realBasePath)) return baseUrl;
    return pathToFileURL(join(packagePath, relative(realRuntimePackagePath, realBasePath))).href;
  } catch {
    return baseUrl;
  }
};

export const remapPackageAssets = (value: unknown, runtimePackagePath: string, packagePath: string) => {
  if (isPackageAssetDescriptor(value)) {
    return {
      ...value,
      baseUrl: remapRuntimeBaseUrl(value.baseUrl, runtimePackagePath, packagePath),
    };
  }

  if (Array.isArray(value)) {
    const mapped: unknown[] = value.map((item) => remapPackageAssets(item, runtimePackagePath, packagePath));
    return mapped;
  }

  if (!isRecord(value)) return value;

  const mapped: Record<string, unknown> = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, remapPackageAssets(item, runtimePackagePath, packagePath)]),
  );
  return mapped;
};
