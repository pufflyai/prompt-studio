import plannerExtension, { PLANNER_EXTENSION_PACKAGE_NAME } from "@pstdio/pstdio-ext-planner";
import type { ExtensionDefinition, ExtensionDiagnostic, ExtensionSourceKind } from "@pstdio/sdk/extensions";
import { createErrorDiagnostic } from "./diagnostics";
import { discoverExtensionFiles } from "./discovery";
import { importExtensionModule } from "./importer";

export type LoadedExtensionSource = {
  sourcePath: string;
  sourceKind: ExtensionSourceKind;
  definition: ExtensionDefinition;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const firstPartyPackageSources = [
  {
    sourcePath: PLANNER_EXTENSION_PACKAGE_NAME,
    sourceKind: "package" as const,
    definition: plannerExtension,
  },
];

export const loadExtensionSources = async (projectRoot: string) => {
  const diagnostics: ExtensionDiagnostic[] = [];
  const sources: LoadedExtensionSource[] = [...firstPartyPackageSources];

  for (const sourcePath of discoverExtensionFiles(projectRoot)) {
    let mod: Record<string, unknown>;
    try {
      mod = await importExtensionModule(sourcePath);
    } catch (error) {
      diagnostics.push(
        createErrorDiagnostic({
          code: "invalid_export",
          message: `Extension file failed to import: ${error instanceof Error ? error.message : sourcePath}`,
          sourcePath,
        }),
      );
      continue;
    }

    if (!("default" in mod) || mod.default === undefined || !isRecord(mod.default)) {
      diagnostics.push(
        createErrorDiagnostic({
          code: "invalid_export",
          message: "Extension file must export a default extension definition object",
          sourcePath,
        }),
      );
      continue;
    }

    sources.push({
      sourcePath,
      sourceKind: "local",
      definition: mod.default as ExtensionDefinition,
    });
  }

  return { sources, diagnostics };
};
