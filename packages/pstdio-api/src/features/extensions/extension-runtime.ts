import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import type { ExtensionsCheckResponse } from "pstdio-api-contracts";
import { collectAssetsAndUi, collectCommands, collectMiddlewareHooksAndSchedules } from "./extension-contributions";
import { addDiagnostic, isRecord, type UnknownRecord } from "./extension-diagnostics";
import { createExtensionIgnoreMatcher } from "./extension-ignore";

export type ExtensionMetadata = {
  apiVersion: "1";
  id: string;
  name: string;
  namespace: string;
  version?: string;
};

export type LoadedExtension = {
  definition: UnknownRecord;
  manifest: UnknownRecord;
  metadata: ExtensionMetadata;
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
  views: [],
  routes: [],
  navigation: [],
  settingsPanels: [],
  templates: [],
  skills: [],
  diagnostics: [],
});

const manifestSnapshot = (definition: UnknownRecord) => ({
  apiVersion: definition.apiVersion,
  artifactMounts: Object.keys((definition.artifactMounts as UnknownRecord | undefined) ?? {}),
  themes: Object.keys((definition.themes as UnknownRecord | undefined) ?? {}),
  fileIconThemes: Object.keys((definition.fileIconThemes as UnknownRecord | undefined) ?? {}),
  commands: Object.keys((definition.commands as UnknownRecord | undefined) ?? {}),
  hooks: Object.keys((definition.hooks as UnknownRecord | undefined) ?? {}),
  id: definition.id,
  middlewares: Object.keys((definition.middlewares as UnknownRecord | undefined) ?? {}),
  name: definition.name,
  namespace: definition.namespace,
  routes: Object.keys((definition.routes as UnknownRecord | undefined) ?? {}),
  schedules: Object.keys((definition.schedules as UnknownRecord | undefined) ?? {}),
  skills: Object.keys((definition.skills as UnknownRecord | undefined) ?? {}),
  templates: Object.keys((definition.templates as UnknownRecord | undefined) ?? {}),
  version: definition.version,
});

export const loadExtensionSource = async (sourcePath: string) => {
  const entrypoint = join(sourcePath, "extension.ts");
  if (!existsSync(entrypoint)) {
    throw new Error(`Extension entrypoint not found: ${entrypoint}`);
  }

  const url = `${pathToFileURL(entrypoint).href}?t=${Date.now()}-${crypto.randomUUID()}`;
  const mod = (await import(url)) as { default?: unknown };
  const definition = mod.default;

  if (!isRecord(definition)) {
    throw new Error(`Extension default export must be an object: ${entrypoint}`);
  }

  const { id, namespace, name, version, apiVersion } = definition;
  if (typeof id !== "string" || typeof namespace !== "string" || typeof name !== "string" || apiVersion !== "1") {
    throw new Error(
      `Extension default export must include string id, namespace, name and apiVersion "1": ${entrypoint}`,
    );
  }

  return {
    definition,
    manifest: manifestSnapshot(definition),
    metadata: {
      apiVersion,
      id,
      name,
      namespace,
      ...(typeof version === "string" ? { version } : {}),
    },
  } satisfies LoadedExtension;
};

export const checkExtensionSource = async (sourcePath: string, extensionsRoot: string) => {
  const check = emptyCheck(extensionsRoot, existsSync(extensionsRoot));

  try {
    const loaded = await loadExtensionSource(sourcePath);
    check.extensions.push({
      id: loaded.metadata.id,
      displayName: loaded.metadata.name,
      namespace: loaded.metadata.namespace,
      sourcePath,
      version: loaded.metadata.version,
    });
    collectCommands(check, loaded, sourcePath);
    collectMiddlewareHooksAndSchedules(check, loaded, sourcePath);
    collectAssetsAndUi(check, loaded, sourcePath);
    return { check, loaded };
  } catch (error) {
    addDiagnostic(check, {
      code: "extension_load_failed",
      message: error instanceof Error ? error.message : String(error),
      severity: "error",
      sourcePath,
    });
    return { check, loaded: null };
  }
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
  target.views.push(...source.views);
  target.routes.push(...source.routes);
  target.navigation.push(...source.navigation);
  target.settingsPanels.push(...source.settingsPanels);
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
    lines.push("", `${extension.displayName} (${extension.id})`, `  Namespace: ${extension.namespace}`);
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
