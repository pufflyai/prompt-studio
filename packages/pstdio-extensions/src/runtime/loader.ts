import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ExtensionDefinition, ExtensionSourceKind } from "@pstdio/sdk/extensions";
import { isPackageAssetDescriptor } from "../artifacts/asset-validation";
import type { ExtensionDiagnostic } from "../types/runtime";
import { createDiagnostic } from "./diagnostics";
import { discoverExtensionPackages } from "./discovery";
import { type PackageManifest, readPackageManifest } from "./package-manifest";

export type LoadedExtensionSource = {
  /** Path to the extension's package.json directory. */
  packagePath: string;
  /** Resolved entry path (from manifest.main). */
  sourcePath: string;
  sourceKind: ExtensionSourceKind;
  manifest: PackageManifest;
  /**
   * Contributions module. Empty when `main` failed to import; the diagnostic explains
   * why. Identity (`manifest.*`) is still surfaced so the dashboard can render the
   * broken extension instead of dropping it.
   */
  definition: ExtensionDefinition;
};

export type ExtensionPackageRef = {
  /** Path to the extension's package directory. */
  path: string;
  sourceKind?: ExtensionSourceKind;
};

export type LoadExtensionSourcesOptions = {
  /** Directories that contain extension folders (each with a `package.json`). */
  extensionRoots?: Array<{ path: string; sourceKind?: ExtensionSourceKind }>;
  /** Explicit extension packages to load. */
  extensionPackages?: ExtensionPackageRef[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

let importCounter = 0;
const require = createRequire(import.meta.url);

const formatImportError = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  const message = String(error);
  return message === "[object Object]" ? fallback : message;
};

const importWithCacheKey = (filePath: string) =>
  import(`${pathToFileURL(filePath).href}?pstdio_cache=${process.pid}-${importCounter++}`);

const shouldPreserveRuntimePackage = () => process.env.PSTDIO_EXTENSION_RUNTIME_PRESERVE_TEMP === "1";

const existingPathInfo = (path: string) => {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
};

const symlinkPackageChild = (sourcePath: string, targetPath: string) => {
  const stats = lstatSync(sourcePath);
  symlinkSync(sourcePath, targetPath, stats.isDirectory() ? "junction" : "file");
};

const mirrorPackageDirectory = (sourceDir: string, targetDir: string, entrySegments: string[]) => {
  mkdirSync(targetDir, { recursive: true });
  const [entrySegment, ...remainingSegments] = entrySegments;

  for (const dirent of readdirSync(sourceDir, { withFileTypes: true })) {
    if (dirent.name === "node_modules" || dirent.name.startsWith(".pstdio-runtime-")) continue;

    const sourceChild = join(sourceDir, dirent.name);
    const targetChild = join(targetDir, dirent.name);

    if (dirent.name !== entrySegment) {
      symlinkPackageChild(sourceChild, targetChild);
      continue;
    }

    if (remainingSegments.length === 0) {
      copyFileSync(sourceChild, targetChild);
      continue;
    }

    mirrorPackageDirectory(sourceChild, targetChild, remainingSegments);
  }
};

const mirrorNodeModules = (sourceNodeModulesPath: string, targetNodeModulesPath: string) => {
  if (!existsSync(sourceNodeModulesPath)) return;

  mkdirSync(targetNodeModulesPath, { recursive: true });
  for (const dirent of readdirSync(sourceNodeModulesPath, { withFileTypes: true })) {
    const sourceChild = join(sourceNodeModulesPath, dirent.name);
    const targetChild = join(targetNodeModulesPath, dirent.name);

    if (dirent.name !== "@pstdio") {
      symlinkPackageChild(sourceChild, targetChild);
      continue;
    }

    mkdirSync(targetChild, { recursive: true });
    for (const scopedDirent of readdirSync(sourceChild, { withFileTypes: true })) {
      if (scopedDirent.name === "sdk") continue;
      symlinkPackageChild(join(sourceChild, scopedDirent.name), join(targetChild, scopedDirent.name));
    }
  }
};

const createRuntimePackage = (packagePath: string, entryPath: string) => {
  const rootPath = mkdtempSync(join(tmpdir(), "pstdio-runtime-"));
  const runtimePackagePath = join(rootPath, "package");
  const entryRelativePath = relative(packagePath, entryPath);
  const entrySegments = entryRelativePath.split(/[\\/]+/);

  mirrorPackageDirectory(packagePath, runtimePackagePath, entrySegments);
  mirrorNodeModules(join(packagePath, "node_modules"), join(runtimePackagePath, "node_modules"));

  return {
    rootPath,
    entryPath: join(runtimePackagePath, entryRelativePath),
    packagePath: runtimePackagePath,
  };
};

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

const remapRuntimePackageAssets = (value: unknown, runtimePackagePath: string, packagePath: string): unknown => {
  if (isPackageAssetDescriptor(value)) {
    return {
      ...value,
      baseUrl: remapRuntimeBaseUrl(value.baseUrl, runtimePackagePath, packagePath),
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => remapRuntimePackageAssets(item, runtimePackagePath, packagePath));
  }

  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, remapRuntimePackageAssets(item, runtimePackagePath, packagePath)]),
  );
};

const withSdkResolution = async <T>(packagePath: string, run: () => Promise<T>) => {
  const nodeModulesPath = join(packagePath, "node_modules");
  const scopePath = join(nodeModulesPath, "@pstdio");
  const sdkLinkPath = join(scopePath, "sdk");
  const sdkLink = existingPathInfo(sdkLinkPath);
  if (sdkLink && existsSync(sdkLinkPath)) return run();

  mkdirSync(scopePath, { recursive: true });
  if (sdkLink) rmSync(sdkLinkPath, { force: true });
  symlinkSync(dirname(require.resolve("@pstdio/sdk/package.json")), sdkLinkPath, "junction");

  return run();
};

const importFresh = async (filePath: string, packagePath: string) => {
  const runtimePackage = createRuntimePackage(packagePath, filePath);

  try {
    const mod = await withSdkResolution(runtimePackage.packagePath, () => importWithCacheKey(runtimePackage.entryPath));
    return remapRuntimePackageAssets(mod, runtimePackage.packagePath, packagePath);
  } finally {
    if (!shouldPreserveRuntimePackage()) {
      rmSync(runtimePackage.rootPath, { recursive: true, force: true });
    }
  }
};

export const loadExtensionPackage = async (
  pkg: ExtensionPackageRef,
  diagnostics: ExtensionDiagnostic[],
): Promise<LoadedExtensionSource | null> => {
  const { manifest, entryPath, diagnostics: manifestDiagnostics } = readPackageManifest(pkg.path);
  diagnostics.push(...manifestDiagnostics);

  if (!manifest || !entryPath) return null;

  const sourceKind = pkg.sourceKind ?? "local_path";
  let definition: ExtensionDefinition = {};

  try {
    const mod = (await importFresh(entryPath, pkg.path)) as Record<string, unknown>;
    if (!("default" in mod) || mod.default === undefined || !isRecord(mod.default)) {
      diagnostics.push(
        createDiagnostic({
          code: "invalid_default_export",
          message: "Extension entry must export a default contributions object",
          sourcePath: entryPath,
          extensionId: manifest.id,
        }),
      );
    } else {
      definition = mod.default as unknown as ExtensionDefinition;
    }
  } catch (error) {
    diagnostics.push(
      createDiagnostic({
        code: "extension_import_failed",
        message: `Extension entry failed to import: ${formatImportError(error, entryPath)}`,
        sourcePath: entryPath,
        extensionId: manifest.id,
      }),
    );
  }

  return {
    packagePath: pkg.path,
    sourcePath: entryPath,
    sourceKind,
    manifest,
    definition,
  };
};

export const loadExtensionSources = async (options: LoadExtensionSourcesOptions = {}) => {
  const diagnostics: ExtensionDiagnostic[] = [];
  const sources: LoadedExtensionSource[] = [];

  const rootPackages =
    options.extensionRoots?.flatMap((root) =>
      discoverExtensionPackages(root.path).map((path) => ({ path, sourceKind: root.sourceKind ?? "local_path" })),
    ) ?? [];

  const explicitPackages = options.extensionPackages ?? [];

  for (const pkg of [...rootPackages, ...explicitPackages]) {
    const loaded = await loadExtensionPackage(pkg, diagnostics);
    if (loaded) sources.push(loaded);
  }

  return { sources, diagnostics };
};
