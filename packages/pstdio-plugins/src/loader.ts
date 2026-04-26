import { existsSync, linkSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { derivePluginIdentity, discoverPluginFiles } from "./discovery";
import type { LoadedPlugin, PluginDefinition } from "./types";

const isValidPluginShape = (value: unknown): value is PluginDefinition =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCompiledBinary = () => {
  const embeddedFiles = (Bun as Record<string, unknown>).embeddedFiles;
  return Array.isArray(embeddedFiles) && embeddedFiles.length > 0;
};

type PluginSourceVersion = {
  mtimeMs: number;
  size: number;
};

type PluginImportState = {
  version: PluginSourceVersion;
  importUrl: string;
  reloadPath?: string;
};

const pluginImportStates = new Map<string, PluginImportState>();

const importBundledPluginModule = async (filePath: string) => {
  const tempDir = mkdtempSync(join(tmpdir(), "pstdio-plugin-build-"));
  const outputName = `${basename(filePath).replace(/\.[^.]+$/, "")}.js`;

  try {
    const result = await Bun.build({
      entrypoints: [filePath],
      outdir: tempDir,
      naming: "[name].js",
      format: "esm",
      target: "bun",
    });

    if (!result.success) {
      throw new Error(`Failed to bundle plugin module: ${filePath}`);
    }

    return import(pathToFileURL(join(tempDir, outputName)).href);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
};

const createReloadPath = (filePath: string, sourceVersion: PluginSourceVersion) => {
  const extension = extname(filePath);
  const baseName = basename(filePath, extension);

  return join(dirname(filePath), `.${baseName}.reload-${sourceVersion.mtimeMs}-${sourceVersion.size}.test${extension}`);
};

const createReloadedImportState = (filePath: string, sourceVersion: PluginSourceVersion) => {
  const reloadPath = createReloadPath(filePath, sourceVersion);

  rmSync(reloadPath, { force: true });
  linkSync(filePath, reloadPath);

  return {
    version: sourceVersion,
    importUrl: pathToFileURL(reloadPath).href,
    reloadPath,
  } satisfies PluginImportState;
};

const importModuleAtUrl = async (importUrl: string) => import(importUrl);

const sameVersion = (left: PluginSourceVersion, right: PluginSourceVersion) =>
  left.mtimeMs === right.mtimeMs && left.size === right.size;

const setPluginImportState = (filePath: string, nextState: PluginImportState) => {
  const previousState = pluginImportStates.get(filePath);

  if (previousState?.reloadPath && previousState.reloadPath !== nextState.reloadPath) {
    rmSync(previousState.reloadPath, { force: true });
  }

  pluginImportStates.set(filePath, nextState);
};

const importReloadedSourceModule = async (filePath: string, sourceVersion: PluginSourceVersion) => {
  const nextState = createReloadedImportState(filePath, sourceVersion);

  try {
    const mod = await importModuleAtUrl(nextState.importUrl);
    setPluginImportState(filePath, nextState);
    return mod;
  } finally {
    if (!pluginImportStates.get(filePath)?.reloadPath) {
      rmSync(nextState.reloadPath, { force: true });
    }
  }
};

const importPluginModule = async (filePath: string) => {
  if (isCompiledBinary()) {
    return importBundledPluginModule(filePath);
  }

  const sourceStat = statSync(filePath);
  const sourceVersion = { mtimeMs: sourceStat.mtimeMs, size: sourceStat.size };
  const currentState = pluginImportStates.get(filePath);

  if (currentState && sameVersion(currentState.version, sourceVersion)) {
    if (currentState.reloadPath && !existsSync(currentState.reloadPath)) {
      const restoredState = createReloadedImportState(filePath, sourceVersion);
      setPluginImportState(filePath, restoredState);
      return importModuleAtUrl(restoredState.importUrl).catch(() => importBundledPluginModule(filePath));
    }

    return importModuleAtUrl(currentState.importUrl).catch(() => importBundledPluginModule(filePath));
  }

  if (currentState) {
    // Bun caches file imports by resolved path (ignoring URL query params), so
    // reloads after file edits need a new path to force re-evaluation.
    return importReloadedSourceModule(filePath, sourceVersion).catch(() => importBundledPluginModule(filePath));
  }

  // Bun caches file imports by resolved path (ignoring URL query params), so
  // source imports are used until the file changes to preserve module identity.
  try {
    const importUrl = pathToFileURL(filePath).href;
    const mod = await importModuleAtUrl(importUrl);
    setPluginImportState(filePath, { version: sourceVersion, importUrl });
    return mod;
  } catch {
    const mod = await importBundledPluginModule(filePath);
    setPluginImportState(filePath, { version: sourceVersion, importUrl: pathToFileURL(filePath).href });
    return mod;
  }
};

const assertValidSchedules = (pluginIdentity: string, definition: PluginDefinition) => {
  for (const schedule of definition.schedules ?? []) {
    let parsed: Date | null;
    try {
      parsed = Bun.cron.parse(schedule.cron);
    } catch {
      parsed = null;
    }

    if (parsed !== null) continue;

    throw new Error(
      `Plugin "${pluginIdentity}" schedule "${schedule.name}" has invalid cron expression: "${schedule.cron}"`,
    );
  }
};

export const loadPlugins = async (pluginsDir: string) => {
  const files = discoverPluginFiles(pluginsDir);
  if (files.length === 0) return [];

  for (const filePath of pluginImportStates.keys()) {
    if (dirname(filePath) !== pluginsDir && !filePath.startsWith(`${pluginsDir}/`)) continue;
    if (files.includes(filePath)) continue;

    const state = pluginImportStates.get(filePath);
    if (state?.reloadPath) {
      rmSync(state.reloadPath, { force: true });
    }
    pluginImportStates.delete(filePath);
  }

  const plugins: LoadedPlugin[] = [];
  const identitySources = new Map<string, string>();

  for (const filePath of files) {
    let mod: Record<string, unknown>;
    try {
      mod = await importPluginModule(filePath);
    } catch {
      continue;
    }

    if (!("default" in mod) || mod.default === undefined) continue;

    const definition = mod.default;

    if (!isValidPluginShape(definition)) {
      throw new Error(`Plugin file ${filePath}: default export is not a valid plugin definition`);
    }

    const identity = derivePluginIdentity(pluginsDir, filePath);
    const existing = identitySources.get(identity);
    if (existing) {
      throw new Error(`Duplicate plugin identity "${identity}" from files: ${existing}, ${filePath}`);
    }

    identitySources.set(identity, filePath);
    assertValidSchedules(identity, definition);
    plugins.push({ identity, filePath, definition });
  }

  return plugins;
};
