import { readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PackageAssetDescriptor, SkillFile } from "pstdio-api-contracts";
import type { UnknownRecord } from "../features/extensions/extension-diagnostics";

export class ExtensionCatalogAssetError extends Error {
  status = 400 as const;
}

export type ExtensionContributionContext = {
  extensionId: string;
  extensionInstanceId: string;
  installedExtensionId: string;
  installName: string;
  /** Package name of the owning extension (was previously `namespace`). */
  name: string;
  sourcePath: string;
};

export const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isPackageAssetDescriptor = (value: unknown): value is PackageAssetDescriptor =>
  isRecord(value) &&
  value.kind === "package-asset" &&
  typeof value.path === "string" &&
  typeof value.baseUrl === "string";

export const catalogNameFromKey = (key: string) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s.]+/g, "-")
    .toLowerCase();

export const catalogId = (input: { extensionInstanceId: string; key: string; sourceKind: "skill" | "template" }) =>
  `extension:${input.sourceKind}:${input.extensionInstanceId}:${input.key}`;

const assertInsideRoot = (sourceRoot: string, targetPath: string) => {
  let root: string;
  let target: string;
  try {
    root = realpathSync(sourceRoot);
    target = realpathSync(targetPath);
  } catch {
    throw new ExtensionCatalogAssetError(`Package asset is missing: ${targetPath}`);
  }
  const rel = relative(root, target);

  if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) {
    return target;
  }

  throw new ExtensionCatalogAssetError(`Package asset resolves outside installed extension source: ${targetPath}`);
};

export const resolvePackageAssetPath = (sourceRoot: string, source: unknown) => {
  if (!isPackageAssetDescriptor(source)) {
    throw new ExtensionCatalogAssetError("Extension contribution source must use packageAsset(...)");
  }

  let targetPath: string;
  try {
    targetPath = fileURLToPath(new URL(source.path, source.baseUrl));
  } catch {
    throw new ExtensionCatalogAssetError(`Invalid package asset URL: ${source.path}`);
  }

  return assertInsideRoot(sourceRoot, targetPath);
};

export const readTextPackageAsset = (sourceRoot: string, source: unknown) =>
  readFileSync(resolvePackageAssetPath(sourceRoot, source), "utf8");

export const writeTextPackageAsset = (sourceRoot: string, source: unknown, content: string) => {
  const filePath = resolvePackageAssetPath(sourceRoot, source);
  if (!statSync(filePath).isFile()) {
    throw new ExtensionCatalogAssetError("Extension template source must resolve to a file");
  }
  writeFileSync(filePath, content, "utf8");
};

const sortSkillFiles = (files: SkillFile[]) =>
  [...files].sort((a, b) => {
    if (a.path === "SKILL.md") return -1;
    if (b.path === "SKILL.md") return 1;
    return a.path.localeCompare(b.path);
  });

const collectDirectorySkillFiles = (rootPath: string, currentPath = rootPath): SkillFile[] => {
  const files: SkillFile[] = [];
  for (const entry of readdirSync(currentPath, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(currentPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectDirectorySkillFiles(rootPath, path));
      continue;
    }
    if (!entry.isFile()) continue;

    const rel = relative(rootPath, path).replaceAll("\\", "/");
    files.push({ path: rel, content: readFileSync(path, "utf8"), encoding: "utf8" });
  }
  return files;
};

export const readSkillPackageAssetFiles = (sourceRoot: string, source: unknown) => {
  const assetPath = resolvePackageAssetPath(sourceRoot, source);
  const stat = statSync(assetPath);

  if (stat.isDirectory()) {
    return sortSkillFiles(collectDirectorySkillFiles(assetPath));
  }

  if (!stat.isFile()) {
    throw new ExtensionCatalogAssetError("Extension skill source must resolve to a file or directory");
  }

  const path = basename(assetPath) === "SKILL.md" ? "SKILL.md" : "SKILL.md";
  return [{ path, content: readFileSync(assetPath, "utf8"), encoding: "utf8" as const }];
};

export const sourceRootForAsset = (sourcePath: string) => resolve(sourcePath);
