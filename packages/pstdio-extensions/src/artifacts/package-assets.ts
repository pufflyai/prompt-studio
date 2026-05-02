import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PackageAssetDescriptor } from "@pstdio/sdk/extensions";
import { isPackageAssetDescriptor } from "./asset-validation";

type PackageAssetContext = {
  /** Optional override for the resolved path of the extension source file. */
  sourcePath?: string;
  /** Optional override for the directory considered the asset root. */
  assetRoot?: string;
};

export class PackageAssetError extends Error {
  code = "invalid_package_asset" as const;
}

const isInside = (root: string, path: string) => {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

const resolveBasePath = (baseUrl: string) => {
  try {
    return fileURLToPath(new URL(baseUrl));
  } catch (error) {
    throw new PackageAssetError(
      `Package asset base URL "${baseUrl}" is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const resolvePackageAssetPath = (asset: PackageAssetDescriptor, context: PackageAssetContext = {}) => {
  if (!isPackageAssetDescriptor(asset)) {
    throw new PackageAssetError("Package asset must be declared with packageAsset(...)");
  }

  if (asset.path.includes("\0") || isAbsolute(asset.path)) {
    throw new PackageAssetError(`Package asset path "${asset.path}" must be relative`);
  }

  const declaredBasePath = resolveBasePath(asset.baseUrl);
  const basePath = existsSync(declaredBasePath) ? declaredBasePath : (context.sourcePath ?? declaredBasePath);
  const baseDir = dirname(basePath);
  const assetPath = resolve(baseDir, ...asset.path.split(/[\\/]+/));
  const assetRoot = context.assetRoot ?? baseDir;

  if (!isInside(assetRoot, assetPath)) {
    throw new PackageAssetError(`Package asset path "${asset.path}" must stay under the extension asset root`);
  }

  if (!existsSync(assetPath) || !statSync(assetPath).isFile()) {
    throw new PackageAssetError(`Package asset "${asset.path}" does not exist`);
  }

  return assetPath;
};

export const readPackageAssetBytes = async (asset: PackageAssetDescriptor, context: PackageAssetContext = {}) =>
  new Uint8Array(await readFile(resolvePackageAssetPath(asset, context)));

export const readPackageAssetText = async (asset: PackageAssetDescriptor, context: PackageAssetContext = {}) =>
  readFile(resolvePackageAssetPath(asset, context), "utf8");
