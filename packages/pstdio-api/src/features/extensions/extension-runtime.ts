import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionDiagnostic, ExtensionHostCapabilities, ExtensionsCheckResponse } from "pstdio-api-contracts";
import {
  checkExtensionHostCompatibility,
  collectConventionDiagnostics,
  dashboardExtensionHostCapabilities,
  loadExtensionPackage,
  normalizeExtensionSources,
  type PackageManifest,
  type ExtensionDiagnostic as RuntimeExtensionDiagnostic,
  readPackageManifest,
  readPackageManifestMetadata,
} from "pstdio-extensions";
import { createWorkbenchExtensionMetadata } from "pstdio-extensions/workbench";
import {
  toCheckArtifactMounts,
  toCheckFileIconThemes,
  toCheckHooks,
  toCheckMiddlewares,
  toCheckSchedules,
  toCheckSkills,
  toCheckTemplates,
  toCheckThemes,
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
  diagnostics: RuntimeExtensionDiagnostic[];
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
  pages: [],
  views: [],
  viewMenus: [],
  placements: [],
  resourceKinds: [],
  resourceViews: [],
  resourceHierarchyProviders: [],
  navigationItems: [],
  statusBarItems: [],
  statuses: [],
  activityItems: [],
  settingsSections: [],
  keybindings: [],
  settingsPanels: [],
  commandPaletteResources: [],
  settingsDefinitions: [],
  templates: [],
  skills: [],
  diagnostics: [],
  hostCompatibility: {
    status: "verified",
    host: dashboardExtensionHostCapabilities,
    diagnostics: [],
  },
});

type CheckExtensionHostOptions = {
  hostCapabilities?: ExtensionHostCapabilities | null;
};

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
  views: Array.isArray(definition.views) ? definition.views : [],
  navigationItems: Array.isArray(definition.navigationItems) ? definition.navigationItems : [],
  placements: Array.isArray(definition.placements) ? definition.placements : [],
  commandPaletteResources: Object.keys((definition.commandPaletteResources as UnknownRecord | undefined) ?? {}),
  modes: Array.isArray(definition.modes) ? definition.modes : [],
  schedules: Array.isArray(definition.schedules) ? definition.schedules : [],
  skills: Array.isArray(definition.skills) ? definition.skills : [],
  templates: Array.isArray(definition.templates) ? definition.templates : [],
});

export const loadExtensionSource = async (sourcePath: string) => {
  const diagnostics: RuntimeExtensionDiagnostic[] = [];
  const loaded = await loadExtensionPackage({ path: sourcePath, sourceKind: "local_path" }, diagnostics);

  if (!loaded) {
    const first = diagnostics[0];
    throw new Error(first?.message ?? `Failed to load extension at ${sourcePath}`);
  }

  return toLoadedExtension(loaded, diagnostics);
};

export const loadExtensionSourceRuntime = async (sourcePath: string) => {
  const diagnostics: RuntimeExtensionDiagnostic[] = [];
  const source = await loadExtensionPackage({ path: sourcePath, sourceKind: "local_path" }, diagnostics);

  if (!source) {
    const first = diagnostics[0];
    throw new Error(first?.message ?? `Failed to load extension at ${sourcePath}`);
  }

  return normalizeExtensionSources([source], diagnostics, { repoRoots: [] });
};

export const readExtensionSourceMetadata = (sourcePath: string) => {
  const { manifest, diagnostics } = readPackageManifestMetadata(sourcePath);
  if (!manifest) {
    const first = diagnostics[0];
    throw new Error(first?.message ?? `Failed to read extension metadata at ${sourcePath}`);
  }

  const metadata: ExtensionMetadata = {
    id: manifest.id,
    name: manifest.name,
    displayName: manifest.displayName ?? manifest.name,
    version: manifest.version,
    description: manifest.description,
    enginesPstdio: manifest.enginesPstdio,
    pstdio: manifest.pstdio,
  };

  return {
    definition: {},
    manifest: manifestSnapshot(metadata, {}),
    metadata,
    diagnostics,
  } satisfies LoadedExtension;
};

const toLoadedExtension = (
  loaded: NonNullable<Awaited<ReturnType<typeof loadExtensionPackage>>>,
  diagnostics: RuntimeExtensionDiagnostic[],
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

const addRuntimeDiagnostics = (
  check: ExtensionsCheckResponse,
  diagnostics: Array<ExtensionDiagnostic | RuntimeExtensionDiagnostic>,
) => {
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
  options: CheckExtensionHostOptions = {},
) => {
  const { diagnostics: _runtimeDiagnostics, ...metadata } = createWorkbenchExtensionMetadata({
    runtime,
    resolveWebview: ({ webview }) => ({ ...webview, runtimeUrl: "", moduleUrl: "" }),
  });
  Object.assign(check, metadata);
  check.middlewares.push(...toCheckMiddlewares(runtime.middlewares));
  check.hooks.push(...toCheckHooks(runtime.hooks));
  check.schedules.push(...toCheckSchedules(runtime.schedules));
  check.artifactMounts.push(...toCheckArtifactMounts(runtime.artifactMounts));
  check.themes.push(...toCheckThemes(runtime.themes));
  check.fileIconThemes.push(...toCheckFileIconThemes(runtime.fileIconThemes));
  check.templates.push(...toCheckTemplates(runtime.templates));
  check.skills.push(...toCheckSkills(runtime.skills));
  const hostCompatibility = checkExtensionHostCompatibility(
    runtime,
    options.hostCapabilities === undefined ? dashboardExtensionHostCapabilities : options.hostCapabilities,
  );
  check.hostCompatibility = hostCompatibility;
  addRuntimeDiagnostics(check, hostCompatibility.diagnostics);
};

export const checkExtensionSource = async (
  sourcePath: string,
  extensionsRoot: string,
  options: CheckExtensionHostOptions = {},
) => {
  const check = emptyCheck(extensionsRoot, existsSync(extensionsRoot));
  const diagnostics: RuntimeExtensionDiagnostic[] = [];
  const source = await loadExtensionPackage({ path: sourcePath, sourceKind: "local_path" }, diagnostics);

  if (!source) {
    addRuntimeDiagnostics(check, diagnostics);
    return { check, loaded: null };
  }

  try {
    const loaded = toLoadedExtension(source, diagnostics);
    const runtime = normalizeExtensionSources([source]);
    populateCheckFromRuntime(check, runtime, options);
    addRuntimeDiagnostics(check, loaded.diagnostics);
    addRuntimeDiagnostics(check, runtime.diagnostics);
    // Convention checks (icon names, contribution id casing, dangling command
    // references) report authoring problems the schemas cannot catch.
    addRuntimeDiagnostics(check, collectConventionDiagnostics(runtime));
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

export const checkExtensionsRoot = async (extensionsRoot: string, options: CheckExtensionHostOptions = {}) => {
  const check = emptyCheck(extensionsRoot, existsSync(extensionsRoot));
  if (!existsSync(extensionsRoot)) return check;

  const extensionDirectories = readdirSync(extensionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of extensionDirectories) {
    const sourceCheck = await checkExtensionSource(join(extensionsRoot, entry.name), extensionsRoot, options);
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
    `Host compatibility: ${check.hostCompatibility.status}${
      check.hostCompatibility.host
        ? ` (${check.hostCompatibility.host.host} ${check.hostCompatibility.host.hostVersion})`
        : ""
    }`,
  ];

  for (const extension of check.extensions) {
    lines.push("", `${extension.displayName} (${extension.id})`, `  Name: ${extension.name}`);
    if (extension.version) lines.push(`  Version: ${extension.version}`);
    lines.push(`  Source: ${extension.sourcePath}`);
  }

  for (const diagnostic of check.diagnostics) {
    lines.push("", `${diagnostic.severity.toUpperCase()}: ${diagnostic.message}`);
    const missingCapability = diagnostic.metadata?.missingCapability;
    const contributionId = diagnostic.metadata?.contributionId;
    const requiredSince = diagnostic.metadata?.requiredSince;
    if (typeof contributionId === "string") lines.push(`  Contribution: ${contributionId}`);
    if (typeof missingCapability === "string") lines.push(`  Missing capability: ${missingCapability}`);
    if (typeof requiredSince === "string") lines.push(`  Supported since: ${requiredSince}`);
    if (diagnostic.sourcePath) lines.push(`  Source: ${diagnostic.sourcePath}`);
  }

  return lines.join("\n");
};
