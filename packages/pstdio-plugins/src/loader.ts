import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { derivePluginIdentity, discoverPluginFiles } from "./discovery";
import type { LoadedPlugin, PluginDefinition } from "./types";

const isValidPluginShape = (value: unknown): value is PluginDefinition =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCompiledBinary = () => {
  const embeddedFiles = (Bun as Record<string, unknown>).embeddedFiles;
  return Array.isArray(embeddedFiles) && embeddedFiles.length > 0;
};

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

const importPluginModule = async (filePath: string) => {
  if (isCompiledBinary()) {
    return importBundledPluginModule(filePath);
  }

  try {
    return await import(pathToFileURL(filePath).href);
  } catch {
    return importBundledPluginModule(filePath);
  }
};

export const loadPlugins = async (pluginsDir: string) => {
  const files = discoverPluginFiles(pluginsDir);
  if (files.length === 0) return [];

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
    plugins.push({ identity, filePath, definition });
  }

  return plugins;
};
