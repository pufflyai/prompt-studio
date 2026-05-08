import { statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type { ExtensionDefinition, ExtensionSourceKind } from "@pstdio/sdk/extensions";
import type { ExtensionDiagnostic } from "../types/runtime";
import { createDiagnostic } from "./diagnostics";
import { discoverExtensionFilesInDir } from "./discovery";

export type LoadedExtensionSource = {
  sourcePath: string;
  sourceKind: ExtensionSourceKind;
  definition: ExtensionDefinition;
};

export type ExtensionSourceFile = {
  path: string;
  sourceKind?: ExtensionSourceKind;
};

export type LoadExtensionSourcesOptions = {
  /** Directories that contain extension folders (each with `extension.ts`). */
  extensionRoots?: Array<{ path: string; sourceKind?: ExtensionSourceKind }>;
  /** Explicit extension files to load. */
  extensionFiles?: ExtensionSourceFile[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const importFresh = async (filePath: string) => {
  const version = statSync(filePath).mtimeMs;
  return import(`${pathToFileURL(filePath).href}?mtime=${version}`);
};

export const loadExtensionSourceFile = async (
  source: ExtensionSourceFile,
  diagnostics: ExtensionDiagnostic[],
): Promise<LoadedExtensionSource | null> => {
  let mod: Record<string, unknown>;
  try {
    mod = (await importFresh(source.path)) as Record<string, unknown>;
  } catch (error) {
    diagnostics.push(
      createDiagnostic({
        code: "extension_import_failed",
        message: `Extension file failed to import: ${error instanceof Error ? error.message : source.path}`,
        sourcePath: source.path,
      }),
    );
    return null;
  }

  if (!("default" in mod) || mod.default === undefined || !isRecord(mod.default)) {
    diagnostics.push(
      createDiagnostic({
        code: "invalid_default_export",
        message: "Extension file must export a default extension definition object",
        sourcePath: source.path,
      }),
    );
    return null;
  }

  return {
    sourcePath: source.path,
    sourceKind: source.sourceKind ?? "local",
    definition: mod.default as unknown as ExtensionDefinition,
  };
};

export const loadExtensionSources = async (options: LoadExtensionSourcesOptions = {}) => {
  const diagnostics: ExtensionDiagnostic[] = [];
  const sources: LoadedExtensionSource[] = [];

  const rootFiles =
    options.extensionRoots?.flatMap((root) =>
      discoverExtensionFilesInDir(root.path).map((path) => ({ path, sourceKind: root.sourceKind ?? "local" })),
    ) ?? [];

  const explicitFiles = options.extensionFiles ?? [];

  for (const file of [...rootFiles, ...explicitFiles]) {
    const loaded = await loadExtensionSourceFile(file, diagnostics);
    if (loaded) sources.push(loaded);
  }

  return { sources, diagnostics };
};
