import { join } from "node:path";
import type { ExtensionDefinition, ExtensionSourceKind } from "@pstdio/sdk/extensions";
import { remapPackageAssets } from "../artifacts/remap-package-assets";
import type { ExtensionDiagnostic } from "../types/runtime";
import { loadBackendDefinition } from "./backend-process/backend-workers";
import { hydrateBackendDefinition, type PrepareBackendRuntime } from "./backend-process/hydrate";
import { createDiagnostic } from "./diagnostics";
import { discoverExtensionPackages } from "./discovery";
import {
  type ExtensionApiProvider,
  getExtensionApiVersionError,
  type PackageManifest,
  readPackageManifestMetadata,
  unavailableManifestLoadKey,
} from "./package-manifest";
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
   * Contributions module. Empty when the API is incompatible or `main` failed to import; the diagnostic explains
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
  definitionOnly?: boolean;
  prepareRuntime?: (path: string, revision: PreparedExtensionRevision) => PrepareBackendRuntime | undefined;
};

let loadCounter = 0;
// Counts definition loads, whether the revision's cache or a worker supplied the definition. Worker
// reads alone are counted by readBackendDefinitionReadCount.
export const readExtensionLoadCount = () => loadCounter;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const formatImportError = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  // Bun throws a ResolveMessage (not an Error) when a bare import cannot be resolved;
  // surface its message instead of the opaque fallback path.
  if (isRecord(error) && typeof error.message === "string" && error.message.length > 0) return error.message;
  const message = String(error);
  return message === "[object Object]" ? fallback : message;
};

// The host never imports an entry. A worker evaluates it and reports data and handler references.
const loadDefinition = async (
  packagePath: string,
  revision: PreparedExtensionRevision,
  options: {
    definitionOnly?: boolean;
    prepareRuntime?: (revision: PreparedExtensionRevision) => PrepareBackendRuntime | undefined;
  },
) => {
  loadCounter += 1;
  const { definition: reported, acquire } = await loadBackendDefinition(packagePath, revision, options.definitionOnly);
  const prepareRuntime = options.definitionOnly ? undefined : options.prepareRuntime?.(revision);
  return hydrateBackendDefinition(reported, acquire, prepareRuntime) as Record<string, unknown>;
};

// Synchronous authoring API. The running host uses inspectExtensionLoadKey in its worker.
export const extensionLoadKey = (packagePath: string) => {
  const unavailable = unavailableManifestLoadKey(packagePath);
  if (unavailable) return unavailable;
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
    definitionOnly?: boolean;
    prepareRuntime?: (revision: PreparedExtensionRevision) => PrepareBackendRuntime | undefined;
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
    : readPackageManifestMetadata(pkg.path);
  diagnostics.push(...manifestDiagnostics);

  if (!manifest || !entryPath) return null;

  const sourceKind = pkg.sourceKind ?? "local_path";
  let definition: ExtensionDefinition = {};

  // Incompatible tools keep their identity for recovery without importing their code.
  const versionError = getExtensionApiVersionError(manifest.name, manifest.enginesPstdio, options);
  if (versionError) {
    diagnostics.push(
      createDiagnostic({
        code: "extension_manifest_unsupported_api_version",
        message: versionError,
        sourcePath: join(pkg.path, "package.json"),
        extensionId: manifest.id,
      }),
    );
    return { packagePath: pkg.path, sourcePath: entryPath, sourceKind, manifest, definition };
  }

  let preparedRevision = options.preparedRevision;
  try {
    // This preparation supplies live callbacks, even when a background registry
    // initiated the load. Readers must not repeatedly retire the import they await.
    preparedRevision ??= await prepareExtensionRevision(pkg.path, {
      apiProvider: options.apiProvider,
      priority: "requested",
    });
    retainPreparedRevision(preparedRevision);
    const loaded = await loadDefinition(pkg.path, preparedRevision, options);
    definition = (
      options.immutableAssets ? loaded : remapPackageAssets(loaded, preparedRevision.packagePath, pkg.path)
    ) as ExtensionDefinition;
  } catch (error) {
    if (error instanceof PreparationUnavailableError) throw error;
    const invalidExport = isRecord(error) && error.code === "invalid_default_export";
    diagnostics.push(
      createDiagnostic({
        code: invalidExport ? "invalid_default_export" : "extension_import_failed",
        message: invalidExport
          ? formatImportError(error, entryPath)
          : `Extension entry failed to import: ${formatImportError(error, entryPath)}`,
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

  const { prepareRuntime } = options;
  for (const pkg of [...rootPackages, ...explicitPackages]) {
    const loaded = await loadExtensionPackage(pkg, diagnostics, {
      apiProvider: options.apiProvider,
      preparedRevision: options.preparedRevision,
      immutableAssets: options.immutableAssets,
      definitionOnly: options.definitionOnly,
      prepareRuntime: prepareRuntime && ((revision) => prepareRuntime(pkg.path, revision)),
    });
    if (loaded) sources.push(loaded);
  }

  return { sources, diagnostics };
};
