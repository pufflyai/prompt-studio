import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { PackageAssetDescriptor } from "@pstdio/sdk/extensions";
import { isPackageAssetDescriptor } from "./asset-validation";

type PackageAssetContext = {
  sourcePath?: string;
  assetRoot?: string;
};

export class PackageAssetError extends Error {
  code = "invalid_package_asset" as const;
}

const assertRelativeSourcePath = (sourcePath: string) => {
  if (sourcePath.includes("\0") || isAbsolute(sourcePath)) {
    throw new PackageAssetError(`Package asset path "${sourcePath}" must be relative`);
  }
};

const isInside = (root: string, path: string) => {
  const relativePath = relative(root, path);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
};

const findLocalExtensionsRoot = (sourcePath: string) => {
  let current = dirname(sourcePath);

  while (current !== dirname(current)) {
    const parent = dirname(current);
    if (
      current.endsWith(`${sep}.pstdio${sep}extensions`) ||
      (current.endsWith(`${sep}extensions`) && parent.endsWith(`${sep}.pstdio`))
    ) {
      return current;
    }
    current = parent;
  }

  return null;
};

const findPackageRoot = (sourcePath: string) => {
  let current = dirname(sourcePath);

  while (current !== dirname(current)) {
    if (existsSync(resolve(current, "package.json"))) return current;
    current = dirname(current);
  }

  return null;
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

const resolveAssetRoot = (assetBasePath: string, context: PackageAssetContext) =>
  context.assetRoot ??
  findLocalExtensionsRoot(assetBasePath) ??
  (context.sourcePath ? findLocalExtensionsRoot(context.sourcePath) : null) ??
  findPackageRoot(assetBasePath) ??
  dirname(assetBasePath);

export const resolvePackageAssetPath = (asset: PackageAssetDescriptor, context: PackageAssetContext = {}) => {
  if (!isPackageAssetDescriptor(asset)) {
    throw new PackageAssetError("Package asset must be declared with packageAsset(...)");
  }

  assertRelativeSourcePath(asset.sourcePath);

  const declaredBasePath = resolveBasePath(asset.baseUrl);
  const assetBasePath = existsSync(declaredBasePath) ? declaredBasePath : (context.sourcePath ?? declaredBasePath);
  const assetPath = resolve(dirname(assetBasePath), ...asset.sourcePath.split(/[\\/]+/));
  const assetRoot = resolveAssetRoot(assetBasePath, context);

  if (!isInside(assetRoot, assetPath)) {
    throw new PackageAssetError(`Package asset path "${asset.sourcePath}" must stay under the extension asset root`);
  }

  if (!existsSync(assetPath) || !statSync(assetPath).isFile()) {
    throw new PackageAssetError(`Package asset "${asset.sourcePath}" does not exist`);
  }

  return assetPath;
};

export const readPackageAssetBytes = async (asset: PackageAssetDescriptor, context: PackageAssetContext = {}) =>
  new Uint8Array(await readFile(resolvePackageAssetPath(asset, context)));

export const readPackageAssetText = async (asset: PackageAssetDescriptor, context: PackageAssetContext = {}) =>
  readFile(resolvePackageAssetPath(asset, context), "utf8");
