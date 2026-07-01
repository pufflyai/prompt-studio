import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionsCheckResponse } from "pstdio-api-contracts";
import {
  type ExtensionDiagnostic,
  loadExtensionPackage,
  normalizeExtensionSources,
  type PackageManifest,
  readPackageManifest,
} from "pstdio-extensions";
import { toKeybindingRecord } from "pstdio-extensions/workbench";
import {
  collectCheckModes,
  toCheckArtifactMounts,
  toCheckCommandPaletteResources,
  toCheckCommands,
  toCheckControlsRenderers,
  toCheckDataRenderers,
  toCheckFileIconThemes,
  toCheckFileRenderers,
  toCheckHooks,
  toCheckMenuContributions,
  toCheckMiddlewares,
  toCheckPaletteContributions,
  toCheckRoutes,
  toCheckSchedules,
  toCheckSettingsDefinitions,
  toCheckSettingsPanels,
  toCheckSkills,
  toCheckTemplates,
  toCheckThemes,
  toCheckTreeItems,
  toCheckTreeRenderers,
  toCheckViews,
} from "./check-from-runtime";
import { addDiagnostic, isRecord, type UnknownRecord } from "./extension-diagnostics";
import { mergeCheck } from "./merge-checks";

export { hashExtensionSource } from "./hash-extension-source";

export type ExtensionMetadata = {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description?: string;
  enginesPstdio: string;
  pstdio?: PackageManifest["pstdio"];
};

export type LoadedExtension = {
  definition: UnknownRecord;
  manifest: UnknownRecord;
  metadata: ExtensionMetadata;
  diagnostics: ExtensionDiagnostic[];
};

const emptyCheck = (extensionsRoot: string, exists: boolean): ExtensionsCheckResponse => ({
  extensionsRoot,
  extensionsRootExists: exists,
  errorCount: 0,
  warningCount: 0,
  extensions: [],
  commands: [],
  middlewares: [],
  hooks: [],
  schedules: [],
  artifactMounts: [],
  themes: [],
  fileIconThemes: [],
  menuContributions: [],
  commandPaletteContributions: [],
  modes: [],
  views: [],
  routes: [],
  navigation: [],
  treeItems: [],
  treeRenderers: [],
  fileRenderers: [],
  controlsRenderers: [],
  keybindings: [],
  settingsPanels: [],
  dataRenderers: [],
  commandPaletteResources: [],
  settingsDefinitions: [],
  templates: [],
  skills: [],
  diagnostics: [],
});

const manifestSnapshot = (metadata: ExtensionMetadata, definition: UnknownRecord): UnknownRecord => ({
  id: metadata.id,
  name: metadata.name,
  displayName: metadata.displayName,
  version: metadata.version,
  description: metadata.description,
  enginesPstdio: metadata.enginesPstdio,
  ...(metadata.pstdio ? { pstdio: metadata.pstdio } : {}),
  artifactMounts: Object.keys((definition.artifactMounts as UnknownRecord | undefined) ?? {}),
  themes: Object.keys((definition.themes as UnknownRecord | undefined) ?? {}),
  fileIconThemes: Object.keys((definition.fileIconThemes as UnknownRecord | undefined) ?? {}),
  commands: Object.keys((definition.commands as UnknownRecord | undefined) ?? {}),
  hooks: Object.keys((definition.hooks as UnknownRecord | undefined) ?? {}),
  middlewares: Object.keys((definition.middlewares as UnknownRecord | undefined) ?? {}),
  routes: Object.keys((definition.routes as UnknownRecord | undefined) ?? {}),
  treeRenderers: Object.keys((definition.treeRenderers as UnknownRecord | undefined) ?? {}),
  dataRenderers: Object.keys((definition.dataRenderers as UnknownRecord | undefined) ?? {}),
  commandPaletteResources: Object.keys((definition.commandPaletteResources as UnknownRecord | undefined) ?? {}),
  controlsRenderers: Object.keys((definition.controlsRenderers as UnknownRecord | undefined) ?? {}),
  modes: Object.keys((definition.modes as UnknownRecord | undefined) ?? {}),
  schedules: Object.keys((definition.schedules as UnknownRecord | undefined) ?? {}),
  skills: Object.keys((definition.skills as UnknownRecord | undefined) ?? {}),
  templates: Object.keys((definition.templates as UnknownRecord | undefined) ?? {}),
});

export const loadExtensionSource = async (sourcePath: string) => {
  const diagnostics: ExtensionDiagnostic[] = [];
  const loaded = await loadExtensionPackage({ path: sourcePath, sourceKind: "local_path" }, diagnostics);

  if (!loaded) {
    const first = diagnostics[0];
    throw new Error(first?.message ?? `Failed to load extension at ${sourcePath}`);
  }

  return toLoadedExtension(loaded, diagnostics);
};

const toLoadedExtension = (
  loaded: NonNullable<Awaited<ReturnType<typeof loadExtensionPackage>>>,
  diagnostics: ExtensionDiagnostic[],
) => {
  const definition = (loaded.definition ?? {}) as UnknownRecord;
  if (!isRecord(definition)) {
    throw new Error(`Extension default export must be an object: ${loaded.sourcePath}`);
  }

  const metadata: ExtensionMetadata = {
    id: loaded.manifest.id,
    name: loaded.manifest.name,
    displayName: loaded.manifest.displayName ?? loaded.manifest.name,
    version: loaded.manifest.version,
    description: loaded.manifest.description,
    enginesPstdio: loaded.manifest.enginesPstdio,
    pstdio: loaded.manifest.pstdio,
  };

  return {
    definition,
    manifest: manifestSnapshot(metadata, definition),
    metadata,
    diagnostics,
  } satisfies LoadedExtension;
};

const addRuntimeDiagnostics = (check: ExtensionsCheckResponse, diagnostics: ExtensionDiagnostic[]) => {
  for (const diagnostic of diagnostics) {
    addDiagnostic(check, {
      code: diagnostic.code,
      message: diagnostic.message,
      severity: diagnostic.severity,
      sourcePath: diagnostic.sourcePath,
      extensionId: diagnostic.extensionId,
      metadata: diagnostic.metadata,
    });
  }
};

const populateCheckFromRuntime = (
  check: ExtensionsCheckResponse,
  runtime: ReturnType<typeof normalizeExtensionSources>,
) => {
  check.commands.push(...toCheckCommands(runtime.commands));
  check.menuContributions.push(...toCheckMenuContributions(runtime.commands));
  check.commandPaletteContributions.push(...toCheckPaletteContributions(runtime.commands));
  check.middlewares.push(...toCheckMiddlewares(runtime.middlewares));
  check.hooks.push(...toCheckHooks(runtime.hooks));
  check.schedules.push(...toCheckSchedules(runtime.schedules));
  check.artifactMounts.push(...toCheckArtifactMounts(runtime.artifactMounts));
  check.themes.push(...toCheckThemes(runtime.themes));
  check.fileIconThemes.push(...toCheckFileIconThemes(runtime.fileIconThemes));
  check.views.push(...toCheckViews(runtime.views));
  check.routes.push(...toCheckRoutes(runtime.routes));
  check.treeItems.push(...toCheckTreeItems(runtime.treeItems));
  check.treeRenderers.push(...toCheckTreeRenderers(runtime.treeRenderers));
  check.fileRenderers.push(...toCheckFileRenderers(runtime.fileRenderers));
  check.dataRenderers.push(...toCheckDataRenderers(runtime.dataRenderers));
  check.commandPaletteResources.push(...toCheckCommandPaletteResources(runtime.commandPaletteResources));
  check.controlsRenderers.push(...toCheckControlsRenderers(runtime.controlsRenderers));
  check.settingsPanels.push(...toCheckSettingsPanels(runtime.settingsPanels));
  check.settingsDefinitions?.push(...toCheckSettingsDefinitions(runtime.settings));
  check.templates.push(...toCheckTemplates(runtime.templates));
  check.skills.push(...toCheckSkills(runtime.skills));
  check.keybindings.push(...runtime.keybindings.map(toKeybindingRecord));
  collectCheckModes(check, runtime);
};

export const checkExtensionSource = async (sourcePath: string, extensionsRoot: string) => {
  const check = emptyCheck(extensionsRoot, existsSync(extensionsRoot));
  const diagnostics: ExtensionDiagnostic[] = [];
  const source = await loadExtensionPackage({ path: sourcePath, sourceKind: "local_path" }, diagnostics);

  if (!source) {
    addRuntimeDiagnostics(check, diagnostics);
    return { check, loaded: null };
  }

  try {
    const loaded = toLoadedExtension(source, diagnostics);
    check.extensions.push({
      id: loaded.metadata.id,
      name: loaded.metadata.name,
      displayName: loaded.metadata.displayName,
      sourcePath,
      version: loaded.metadata.version,
      description: loaded.metadata.description,
    });
    const runtime = normalizeExtensionSources([source]);
    populateCheckFromRuntime(check, runtime);
    addRuntimeDiagnostics(check, loaded.diagnostics);
    addRuntimeDiagnostics(check, runtime.diagnostics);
    return { check, loaded };
  } catch (error) {
    const fallback = collectFallbackMetadata(sourcePath);
    if (fallback) {
      check.extensions.push({
        id: fallback.id,
        name: fallback.name,
        displayName: fallback.displayName,
        version: fallback.version,
        description: fallback.description,
        sourcePath,
      });
    }
    addDiagnostic(check, {
      code: "extension_load_failed",
      message: error instanceof Error ? error.message : String(error),
      severity: "error",
      sourcePath,
      extensionId: fallback?.id,
    });
    return { check, loaded: null };
  }
};

const collectFallbackMetadata = (sourcePath: string) => {
  const { manifest } = readPackageManifest(sourcePath);
  if (!manifest) return null;
  return {
    id: manifest.id,
    name: manifest.name,
    displayName: manifest.displayName ?? manifest.name,
    version: manifest.version,
    description: manifest.description,
  };
};

export const checkExtensionsRoot = async (extensionsRoot: string) => {
  const check = emptyCheck(extensionsRoot, existsSync(extensionsRoot));
  if (!existsSync(extensionsRoot)) return check;

  const extensionDirectories = readdirSync(extensionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of extensionDirectories) {
    const sourceCheck = await checkExtensionSource(join(extensionsRoot, entry.name), extensionsRoot);
    mergeCheck(check, sourceCheck.check);
  }

  return check;
};

export const formatExtensionsCheck = (check: ExtensionsCheckResponse) => {
  const lines = [
    `Extensions root: ${check.extensionsRoot}`,
    `Extensions found: ${check.extensions.length}`,
    `Commands: ${check.commands.length}`,
    `Warnings: ${check.warningCount}`,
    `Errors: ${check.errorCount}`,
  ];

  for (const extension of check.extensions) {
    lines.push("", `${extension.displayName} (${extension.id})`, `  Name: ${extension.name}`);
    if (extension.version) lines.push(`  Version: ${extension.version}`);
    lines.push(`  Source: ${extension.sourcePath}`);
  }

  for (const diagnostic of check.diagnostics) {
    lines.push("", `${diagnostic.severity.toUpperCase()}: ${diagnostic.message}`);
    if (diagnostic.sourcePath) lines.push(`  Source: ${diagnostic.sourcePath}`);
  }

  return lines.join("\n");
};
