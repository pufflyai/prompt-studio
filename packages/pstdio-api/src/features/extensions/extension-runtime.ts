import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { ExtensionsCheckResponse } from "pstdio-api-contracts";
import {
  type ExtensionDiagnostic,
  loadExtensionPackage,
  type PackageManifest,
  readPackageManifest,
} from "pstdio-extensions";
import { collectAssetsAndUi, collectCommands, collectMiddlewareHooksAndSchedules } from "./extension-contributions";
import { addDiagnostic, isRecord, type UnknownRecord } from "./extension-diagnostics";
import { createExtensionIgnoreMatcher } from "./extension-ignore";
import { reservedDashboardModeIds } from "./extension-mode-layout";

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
    });
  }
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
    collectCommands(check, loaded, sourcePath);
    collectMiddlewareHooksAndSchedules(check, loaded, sourcePath);
    collectAssetsAndUi(check, loaded, sourcePath);
    addRuntimeDiagnostics(check, loaded.diagnostics);
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

  for (const entry of readdirSync(extensionsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sourceCheck = await checkExtensionSource(join(extensionsRoot, entry.name), extensionsRoot);
    mergeCheck(check, sourceCheck.check);
  }

  return check;
};

const mergeCheck = (target: ExtensionsCheckResponse, source: ExtensionsCheckResponse) => {
  target.errorCount += source.errorCount;
  target.warningCount += source.warningCount;
  target.extensions.push(...source.extensions);
  target.commands.push(...source.commands);
  target.middlewares.push(...source.middlewares);
  target.hooks.push(...source.hooks);
  target.schedules.push(...source.schedules);
  target.artifactMounts.push(...source.artifactMounts);
  for (const theme of source.themes) {
    if (target.themes.some((candidate) => candidate.id === theme.id)) {
      addDiagnostic(target, {
        code: "duplicate_theme_id",
        extensionId: theme.extensionId,
        message: `Theme "${theme.id}" is declared by more than one extension`,
        severity: "error",
      });
      continue;
    }
    target.themes.push(theme);
  }
  for (const theme of source.fileIconThemes) {
    if (target.fileIconThemes.some((candidate) => candidate.id === theme.id)) {
      addDiagnostic(target, {
        code: "duplicate_file_icon_theme_id",
        extensionId: theme.extensionId,
        message: `File icon theme "${theme.id}" is declared by more than one extension`,
        severity: "error",
      });
      continue;
    }
    target.fileIconThemes.push(theme);
  }
  target.menuContributions.push(...source.menuContributions);
  target.commandPaletteContributions.push(...source.commandPaletteContributions);
  for (const mode of source.modes) {
    if (
      reservedDashboardModeIds.has(mode.modeId) ||
      target.modes.some((candidate) => candidate.modeId === mode.modeId)
    ) {
      addDiagnostic(target, {
        code: "extension_mode_duplicate",
        extensionId: mode.extensionId,
        message: `Extension "${mode.extensionId}" declares duplicate workbench mode "${mode.modeId}"`,
        severity: "error",
        metadata: { modeId: mode.modeId },
      });
      continue;
    }
    target.modes.push(mode);
  }
  target.views.push(...source.views);
  target.routes.push(...source.routes);
  target.navigation.push(...source.navigation);
  target.treeItems.push(...source.treeItems);
  target.treeRenderers.push(...source.treeRenderers);
  target.settingsPanels.push(...source.settingsPanels);
  target.dataRenderers.push(...source.dataRenderers);
  target.commandPaletteResources.push(...source.commandPaletteResources);
  target.settingsDefinitions?.push(...(source.settingsDefinitions ?? []));
  target.templates.push(...source.templates);
  target.skills.push(...source.skills);
  target.diagnostics.push(...source.diagnostics);
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

export const hashExtensionSource = (sourcePath: string) => {
  const hash = createHash("sha256");
  const matcher = createExtensionIgnoreMatcher(sourcePath);

  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      const rel = relative(sourcePath, path);
      if (matcher.ignores(rel)) continue;

      if (entry.isDirectory()) {
        visit(path);
      } else if (entry.isFile()) {
        const stat = statSync(path);
        hash.update(`${rel}:${stat.size}\n`);
        hash.update(readFileSync(path));
      }
    }
  };

  visit(sourcePath);
  return hash.digest("hex");
};
