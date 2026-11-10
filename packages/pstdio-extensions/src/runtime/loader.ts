import { join } from "node:path";
import type { ExtensionDefinition, ExtensionSourceKind } from "@pstdio/sdk/extensions";
import { remapPackageAssets } from "../artifacts/remap-package-assets";
import type { ExtensionDiagnostic } from "../types/runtime";
import { createDiagnostic } from "./diagnostics";
import { discoverExtensionPackages } from "./discovery";
import { type ExtensionApiProvider, type PackageManifest, readPackageManifest } from "./package-manifest";
import { PreparationUnavailableError } from "./preparation-error";
import { inspectRevisionInputs } from "./prepare-revision";
import { retainPreparedRevision } from "./prepared-cache";
import { type PreparedExtensionRevision, prepareExtensionRevision } from "./prepared-revision";

export type LoadedExtensionSource = {
  /** Path to the extension's package.json directory. */
  packagePath: string;
  originalPackagePath?: string;
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
  preparedRevision?: PreparedExtensionRevision;
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
  /** Who compares `engines.pstdio` with this extension API version. Defaults to the host. */
  apiProvider?: ExtensionApiProvider;
  preparedRevision?: PreparedExtensionRevision;
  immutableAssets?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

let importCounter = 0;
// The import identity already increments for real module loads; reads add no disabled work.
export const readRuntimeImportCount = () => importCounter;

const formatImportError = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  // Bun throws a ResolveMessage (not an Error) when a bare import cannot be resolved;
  // surface its message instead of the opaque fallback path.
  if (isRecord(error) && typeof error.message === "string" && error.message.length > 0) return error.message;
  const message = String(error);
  return message === "[object Object]" ? fallback : message;
};

// Bun 1.4.4 retains failed evaluation for file-URL queries. Absolute-path imports
// preserve the per-load identity without rebuilding immutable output (ADR 0144).
const importWithCacheKey = (filePath: string) => import(`${filePath}?pstdio_cache=${process.pid}-${importCounter++}`);

// Synchronous authoring API. The running host uses inspectExtensionLoadKey in its worker.
export const extensionLoadKey = (packagePath: string) => {
  try {
    return inspectRevisionInputs(packagePath).loadKey;
  } catch (error) {
    return `manifest-${JSON.stringify(error instanceof Error ? error.message : error)}`;
  }
};

export const loadExtensionPackage = async (
  pkg: ExtensionPackageRef,
  diagnostics: ExtensionDiagnostic[],
  options: {
    apiProvider?: ExtensionApiProvider;
    preparedRevision?: PreparedExtensionRevision;
    immutableAssets?: boolean;
  } = {},
): Promise<LoadedExtensionSource | null> => {
  const {
    manifest,
    entryPath,
    diagnostics: manifestDiagnostics,
  } = options.preparedRevision
    ? {
        manifest: options.preparedRevision.manifest,
        entryPath: join(pkg.path, options.preparedRevision.manifest.main),
        diagnostics: options.preparedRevision.diagnostics,
      }
    : readPackageManifest(pkg.path, options);
  diagnostics.push(...manifestDiagnostics);

  if (!manifest || !entryPath) return null;

  const sourceKind = pkg.sourceKind ?? "local_path";
  let definition: ExtensionDefinition = {};

  let preparedRevision = options.preparedRevision;
  try {
    // This preparation supplies live callbacks, even when a background registry
    // initiated the load. Readers must not repeatedly retire the import they await.
    preparedRevision ??= await prepareExtensionRevision(pkg.path, {
      apiProvider: options.apiProvider,
      priority: "requested",
    });
    retainPreparedRevision(preparedRevision);
    const imported = await importWithCacheKey(preparedRevision.entryPath);
    const mod = (
      options.immutableAssets ? imported : remapPackageAssets(imported, preparedRevision.packagePath, pkg.path)
    ) as Record<string, unknown>;
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
    if (error instanceof PreparationUnavailableError) throw error;
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
    packagePath: options.immutableAssets && preparedRevision ? preparedRevision.packagePath : pkg.path,
    originalPackagePath: pkg.path,
    sourcePath:
      options.immutableAssets && preparedRevision ? join(preparedRevision.packagePath, manifest.main) : entryPath,
    sourceKind,
    manifest,
    definition,
    preparedRevision,
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
    const loaded = await loadExtensionPackage(pkg, diagnostics, {
      apiProvider: options.apiProvider,
      preparedRevision: options.preparedRevision,
      immutableAssets: options.immutableAssets,
    });
    if (loaded) sources.push(loaded);
  }

  return { sources, diagnostics };
};
