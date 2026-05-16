import { statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type { ExtensionDefinition, ExtensionSourceKind, PackageManifest } from "@pstdio/sdk/extensions";
import type { ExtensionDiagnostic } from "../types/runtime";
import { createDiagnostic } from "./diagnostics";
import { discoverExtensionPackages } from "./discovery";
import { readPackageManifest } from "./package-manifest";

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

const importFresh = async (filePath: string) => {
  const version = statSync(filePath).mtimeMs;
  return import(`${pathToFileURL(filePath).href}?mtime=${version}`);
};

export const loadExtensionPackage = async (
  pkg: ExtensionPackageRef,
  diagnostics: ExtensionDiagnostic[],
): Promise<LoadedExtensionSource | null> => {
  const { manifest, entryPath, diagnostics: manifestDiagnostics } = readPackageManifest(pkg.path);
  diagnostics.push(...manifestDiagnostics);

  if (!manifest || !entryPath) return null;

  const sourceKind = pkg.sourceKind ?? "local";
  let definition: ExtensionDefinition = {};

  try {
    const mod = (await importFresh(entryPath)) as Record<string, unknown>;
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
        message: `Extension entry failed to import: ${error instanceof Error ? error.message : entryPath}`,
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
      discoverExtensionPackages(root.path).map((path) => ({ path, sourceKind: root.sourceKind ?? "local" })),
    ) ?? [];

  const explicitPackages = options.extensionPackages ?? [];

  for (const pkg of [...rootPackages, ...explicitPackages]) {
    const loaded = await loadExtensionPackage(pkg, diagnostics);
    if (loaded) sources.push(loaded);
  }

  return { sources, diagnostics };
};
