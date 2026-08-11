import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ExtensionDefinition, ExtensionSourceKind } from "@pstdio/sdk/extensions";
import { isPackagedRuntime, resolvePstdioHome } from "pstdio-paths";
import { isPackageAssetDescriptor } from "../artifacts/asset-validation";
import type { ExtensionDiagnostic } from "../types/runtime";
import { bundleEntry } from "./bundle-entry";
import { createDiagnostic } from "./diagnostics";
import { discoverExtensionPackages } from "./discovery";
import { type PackageManifest, readPackageManifest } from "./package-manifest";
import {
  collectRuntimeModulePaths,
  hashRuntimeModulePaths,
  mirrorRuntimeSourceSnapshot,
} from "./runtime-source-snapshot";

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
const prunedRuntimeCacheRoots = new Set<string>();

const formatImportError = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  // Bun throws a ResolveMessage (not an Error) when a bare import cannot be resolved;
  // surface its message instead of the opaque fallback path.
  if (isRecord(error) && typeof error.message === "string" && error.message.length > 0) return error.message;
  const message = String(error);
  return message === "[object Object]" ? fallback : message;
};

const importWithCacheKey = (filePath: string) =>
  import(`${pathToFileURL(filePath).href}?pstdio_cache=${process.pid}-${importCounter++}`);

const runtimeCacheRoot = () => join(resolvePstdioHome(), "cache", "extension-runtime");

const ensureRuntimeCachePruned = (cacheRoot: string) => {
  if (prunedRuntimeCacheRoots.has(cacheRoot)) return;
  rmSync(cacheRoot, { recursive: true, force: true });
  prunedRuntimeCacheRoots.add(cacheRoot);
};

const safeCacheSegment = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "extension";

const digest = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 16);

const symlinkPackageChild = (sourcePath: string, targetPath: string) => {
  const stats = lstatSync(sourcePath);
  symlinkSync(sourcePath, targetPath, stats.isDirectory() ? "junction" : "file");
};

const mirrorNodeModules = (sourceNodeModulesPath: string, targetNodeModulesPath: string) => {
  if (!existsSync(sourceNodeModulesPath)) return;

  mkdirSync(targetNodeModulesPath, { recursive: true });
  for (const dirent of readdirSync(sourceNodeModulesPath, { withFileTypes: true })) {
    const sourceChild = join(sourceNodeModulesPath, dirent.name);
    const targetChild = join(targetNodeModulesPath, dirent.name);

    symlinkPackageChild(sourceChild, targetChild);
  }
};

const resolveNodeModulesPath = (packagePath: string) => {
  let currentPath = packagePath;

  while (true) {
    const nodeModulesPath = join(currentPath, "node_modules");
    if (existsSync(nodeModulesPath)) return nodeModulesPath;

    const parentPath = dirname(currentPath);
    if (parentPath === currentPath) return null;
    currentPath = parentPath;
  }
};

const collectDependencyPackageEntries = (nodeModulesPath: string) => {
  const entries: Array<{ name: string; path: string }> = [];

  for (const dirent of readdirSync(nodeModulesPath, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (dirent.name.startsWith(".") || (!dirent.isDirectory() && !dirent.isSymbolicLink())) continue;

    const packagePath = join(nodeModulesPath, dirent.name);
    if (!dirent.name.startsWith("@")) {
      entries.push({ name: dirent.name, path: packagePath });
      continue;
    }

    if (!existsSync(packagePath)) continue;
    for (const scoped of readdirSync(packagePath, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      if (scoped.name.startsWith(".") || (!scoped.isDirectory() && !scoped.isSymbolicLink())) continue;
      entries.push({ name: `${dirent.name}/${scoped.name}`, path: join(packagePath, scoped.name) });
    }
  }

  return entries;
};

const dependencyPackageState = (nodeModulesPath: string) => {
  const hash = createHash("sha256");
  hash.update(realpathSync(nodeModulesPath));

  for (const entry of collectDependencyPackageEntries(nodeModulesPath)) {
    hash.update("\0");
    hash.update(entry.name);
    hash.update("\0");

    try {
      hash.update(realpathSync(entry.path));
    } catch {
      hash.update("missing");
    }

    const packageJsonPath = join(entry.path, "package.json");
    if (existsSync(packageJsonPath)) hash.update(readFileSync(packageJsonPath));
  }

  return hash.digest("hex").slice(0, 16);
};

const dependencyCacheKey = (nodeModulesPath: string | null) => {
  if (!nodeModulesPath) return "no-node-modules";
  return `node-modules-${dependencyPackageState(nodeModulesPath)}`;
};

const createRuntimePackage = (packagePath: string, entryPath: string, packageName: string) => {
  const cacheRoot = runtimeCacheRoot();
  ensureRuntimeCachePruned(cacheRoot);
  const nodeModulesPath = resolveNodeModulesPath(packagePath);
  const runtimeModulePaths = collectRuntimeModulePaths(packagePath, entryPath);

  const rootPath = join(
    cacheRoot,
    safeCacheSegment(packageName),
    `${digest(resolve(packagePath))}-${hashRuntimeModulePaths(packagePath, runtimeModulePaths)}-${dependencyCacheKey(nodeModulesPath)}`,
  );
  const runtimePackagePath = join(rootPath, "package");
  const entryRelativePath = relative(packagePath, entryPath);

  if (!existsSync(runtimePackagePath)) {
    mirrorRuntimeSourceSnapshot(packagePath, runtimePackagePath, runtimeModulePaths);
    if (nodeModulesPath) mirrorNodeModules(nodeModulesPath, join(runtimePackagePath, "node_modules"));
  } else if (nodeModulesPath && !existsSync(join(runtimePackagePath, "node_modules"))) {
    mirrorNodeModules(nodeModulesPath, join(runtimePackagePath, "node_modules"));
  }

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

const importFresh = async (filePath: string, packagePath: string, packageName: string) => {
  const runtimePackage = createRuntimePackage(packagePath, filePath, packageName);
  const entryPath = isPackagedRuntime()
    ? await bundleEntry(filePath, packagePath, dirname(runtimePackage.entryPath))
    : runtimePackage.entryPath;
  const mod = await importWithCacheKey(entryPath);
  return remapRuntimePackageAssets(mod, runtimePackage.packagePath, packagePath);
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
    const mod = (await importFresh(entryPath, pkg.path, manifest.name)) as Record<string, unknown>;
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
